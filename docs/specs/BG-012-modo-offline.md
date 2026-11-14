# BG-012 — Último estado y avisos sin conexión

Estado: implementado (integrado y desplegado según `docs/plan.md`).

## Intención

Cuando se pierda la conexión durante una sesión de BudGenerator, la persona debe poder seguir consultando el último estado que ya había cargado. El modo offline no debe sustituir ese contenido por skeletons, pantallas de carga ni spinners de lectura. Si se intenta guardar algo sin conexión, la app debe avisar mediante un toast.

## Decisiones y alcance

- El estado reutilizable se conserva en la sesión y en una caché de aplicación de IndexedDB. Incluye los datos de los stores Zustand y las respuestas de páginas que consultan información bajo demanda.
- La caché privada se particiona por UID. Al cerrar sesión o cambiar de cuenta se eliminan las entradas privadas del UID anterior; ninguna cuenta restaura las entradas de otra. Los recursos públicos se identifican con su token de acceso.
- No se activa la caché persistente global de Firestore. Una lectura nueva online actualiza la copia local; sin red, la app restaura el último resultado guardado antes de montar las rutas autenticadas.
- La copia local contiene únicamente datos que la persona ya consultó; no descarga por adelantado toda la cuenta. IndexedDB no se cifra desde la app y queda dentro del perfil/origen del navegador. Si el navegador bloquea o borra IndexedDB, la copia sólo estará disponible durante la sesión abierta.
- Una vista ya visitada muestra su último resultado mientras se conserva en memoria. Si la vista necesita datos que nunca se cargaron en esta sesión, presenta un estado offline claro; no se queda en skeleton ni spinner.
- Si se recarga sin conexión, se restaura la última copia disponible. Las rutas sin una copia previa presentan un estado offline claro.
- Al abrir otra ruta sin conexión, la app usa la copia en memoria disponible para esa vista. Al cambiar de semana en la planificación, conserva el último calendario disponible y no muestra una carga vacía mientras resuelve una consulta offline.
- Los intentos de escritura sin conexión muestran un toast accesible y no se presentan como confirmados. Los cambios que ya se aceptaron online y están en la `WriteQueue` conservan la política actual de reintento al recuperar red; no se introduce una segunda cola.
- Si el navegador dice que hay red pero Firestore o Cloud Functions devuelve un error de red/no disponibilidad durante una mutación, se muestra el mismo toast.
- Si una lectura devuelve un error de red/no disponibilidad aunque `navigator.onLine` siga activo, se conserva el último resultado en memoria y se presenta el estado sin conexión; una lectura fallida no reemplaza la última vista válida.
- El estado que marca la desconexión del navegador se separa de la falta de disponibilidad observada en Firebase. Si el navegador sigue conectado, una petición posterior puede volver a probar el servicio. Mientras Firebase figure offline, se reintenta la carga de sesión cada 30 segundos; al tener éxito, se marca la red disponible y se vacía la `WriteQueue` existente.
- Al recuperarse la red, primero se reintentan las escrituras pendientes. Si se guardan correctamente, se refrescan los stores de sesión y los datos remotos de la vista activa. Si queda alguna escritura pendiente o fallida, se conserva el estado local para no reemplazar cambios sin sincronizar. La recuperación detectada por el propio sondeo de sesión reutiliza las lecturas que ya realizó ese sondeo.
- Si Firebase falla con el navegador conectado y no hay sesión iniciada, la app vuelve a probar la lectura de la ruta pública activa cada 30 segundos. Su propia lectura confirma la recuperación y no inicia una carga privada de sesión.
- Los formularios con cambios sin guardar deben sobrevivir al refresco. El borrador del perfil conserva su indicador de edición en la caché local y evita que una lectura remota lo reemplace; al guardar con éxito, el siguiente refresco puede aplicar el valor remoto.
- En la planificación semanal, perder conexión mantiene la semana consultada y deshabilita el swipe y los controles para cambiar semana hasta recuperarla; días y asignaciones permanecen visibles.
- Al recuperar conexión, se mantiene la última pantalla. Tras sincronizar la cola actual, los datos cargados vuelven a leerse sin recargar el documento ni mostrar skeletons; no se fuerza una recarga global que reemplace contenido visible.
- Se mantiene el aviso de desconexión de la PWA. El toast es independiente y sólo aparece al intentar mutar o cuando falla una escritura ya iniciada.

## Objetivos

- Mantener visibles presupuestos, proyectos, equipo, solicitudes, catálogo, perfil, plantillas y detalles ya consultados, incluso después de recargar sin red.
- Evitar skeletons y estados de carga de lectura mientras `navigator.onLine` indica desconexión.
- Mostrar una notificación breve, en español y con semántica accesible, al intentar una mutación sin conexión; agrupar avisos durante la misma interrupción y habilitarlos de nuevo al recuperar conexión.
- Mantener las solicitudes online y el reintento de la cola actual cuando vuelve la conexión, incluso si `navigator.onLine` no cambió durante un fallo de Firebase.
- Probar offline en navegador con Auth/Firestore Emulator y sin leer/escribir datos reales.

## Fuera de alcance

- Precargar todos los documentos de la cuenta o conservar los datos privados después de cerrar sesión o cambiar de cuenta.
- Edición colaborativa offline, resolución de conflictos, nueva cola de mutaciones o garantías de sincronización.
- Descargar por adelantado todos los documentos de la cuenta.
- Cambiar las reglas de Firestore o desplegar Functions.

## Criterios de aceptación

1. Tras cargar una ruta y perder conexión, sus datos permanecen visibles; no aparecen skeletons ni spinners de lectura al navegar entre vistas que ya tienen resultado en memoria.
2. Una pantalla sin resultado previo muestra un mensaje offline y no una carga indefinida.
3. Una mutación hecha cuando no hay red produce el toast de desconexión y no aparece como guardada/confirmada.
4. Un error `unavailable` o equivalente durante una escritura con estado de red obsoleto produce el mismo toast.
5. Al reconectar, la cola de escrituras existente se procesa antes del refresh de datos. Los stores y la vista activa reflejan datos recientes sin recargar el documento ni mostrar un skeleton.
6. La recarga offline restaura los estados de proyectos y equipo ya consultados sin skeletons de lectura.
7. La caché de un UID no se entrega a otro UID y se elimina al cerrar sesión o cambiar de cuenta.
8. Ninguna mutación nueva se acepta offline ni se incorpora a una cola adicional.

## Revisión de construcción

- Pregunta: ¿un error de red en lectura debe conservar la caché aunque `navigator.onLine` siga activo? **Resuelto por intención:** sí; “sin conexión” incluye errores de disponibilidad real del backend y no depende sólo del indicador del navegador.

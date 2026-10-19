# BG-009 — Proyectos como núcleo, suplementos y catálogo común

**Estado:** aprobada, implementada y verificada en el worktree actualizado con `main` (`0d744fe`). Hosting y reglas de Firestore se desplegaron a `budgenerator` para pruebas el 18-10-2026, con autorización expresa del usuario. Sin cambios en documentos de Firestore, Functions, commit o merge.
**Base:** BG-009 desplegado para pruebas en `budgenerator` desde `codex/bg009-projects`.

**Actualización de catálogo (19-10-2026):** la biblioteca común aprobada ahora es `Reforma integral`, de 30 partidas, y sustituye a `Reforma general` y las bases de oficios en el importador. La actualización es local y no migrará catálogos privados existentes.

## Intención

Hacer de Proyectos la entrada operativa de BudGenerator. Una reforma aceptada debe mantener como referencia el presupuesto original y permitir registrar ampliaciones por imprevistos sin reescribir lo que el cliente aceptó. La experiencia debe enseñar de forma clara el avance, el estado y la evolución del importe, además de guiar a cuentas nuevas hacia este flujo.

## Decisiones de diseño

1. **Proyectos como pantalla principal.** Proyectos pasa a la primera posición de la navegación de escritorio y móvil. La ruta `/` y el enlace de inicio de la marca abren `/projects`. El estado vacío conserva una llamada clara a crear un presupuesto y convertirlo en proyecto.
2. **Cuota Free compartida.** El máximo son tres espacios entre presupuestos y proyectos. La fuente de cuota será `totalBudgetsCreated`: convertir conserva el espacio que ya ocupaba el presupuesto y nunca lo libera. Las plazas históricas de `budgetSlotsReleased` dejan de descontarse y no se incrementan con nuevas conversiones. Cuentas Free que ya superen tres por el comportamiento anterior conservan todo su contenido, pero no pueden crear más presupuestos hasta disponer de cuota conforme al nuevo contador; no se borran ni migran documentos. Borrar presupuestos sigue sin devolver cuota. Suplementos no consumen plazas. Premium conserva su comportamiento actual.
3. **Suplementos desde el proyecto.** El presupuesto aceptado y sus importes permanecen inmutables. Desde el detalle del proyecto se registra una ampliación fechada con descripción, cantidad, unidad y precio unitario; se usa el IVA del presupuesto aceptado y no se vuelve a aplicar el ajuste global ya incluido en el precio original. El formulario se abre al pulsar «Nueva ampliación» y permanece oculto inicialmente para reducir el contenido del detalle. Cada entrada crea un concepto de trabajo pendiente y se guarda en un registro inmutable. El proyecto muestra el importe original aceptado, la suma activa de suplementos y el total actualizado. El avance incluye sus conceptos; si se añade una ampliación a un proyecto completado, este vuelve a quedar en curso. Para corregir una entrada equivocada se crea una anulación inmutable con motivo: se conserva el historial original, y la entrada anulada deja de sumar al importe y al progreso. No se requiere aceptación electrónica del cliente.
4. **Estado visible y estable en móvil.** Listado y detalle presentan etiquetas de estado con color e icono coherentes: pendiente, en curso y completado. El detalle distingue visualmente el resumen económico y de avance del listado de partidas. La fecha de finalización no añade una frase larga a cada fila; se representa con un icono compacto cuya etiqueta accesible conserva la fecha exacta.
5. **Catálogo común importable.** El importador ofrece una única biblioteca completa, “Reforma integral”, organizada en 30 partidas alfabéticas con nombres de una o dos palabras y conceptos de todos los gremios residenciales. Electricidad agrupa cableado, circuitos, cuadro, enchufes, interruptores y puntos de luz. “Varios” agrupa visita técnica, mediciones, licencias y tasas, andamios, protección, limpieza final y mano de obra general. La base para cuentas nuevas contiene los mismos conceptos con precios y costes a cero. La importación sigue omitiendo duplicados y respetando precios que cada empresa ya haya personalizado. Los catálogos guardados no se migran ni sustituyen automáticamente.
6. **Guía y ayuda.** El tour comienza en Proyectos y explica cómo llegar desde un presupuesto aceptado. Ayuda incorpora una FAQ que recorre aceptación, conversión, registro de suplementos y lectura del total actualizado.
7. **Evolución y fechas de finalización.** Un botón visible «Ver progreso» en el resumen del proyecto abre una vista de evolución acumulada por fecha. La gráfica muestra el mismo porcentaje de avance que el proyecto (ponderado por conceptos o importe según su modo) y se deriva de las fechas actuales de finalización de cada concepto, agrupadas por día. Al completar un concepto se guarda la fecha/hora actual; después se puede editar su fecha con un selector de calendario. Completar una partida asigna por defecto la fecha actual a sus conceptos pendientes; editar la fecha de la partida actualiza las fechas de todos sus conceptos. No se permiten fechas futuras. Cambiar una fecha recalcula la gráfica y, si el proyecto está completado, su fecha de finalización resumida. Reabrir un concepto lo quita de la evolución actual. No se crea un historial adicional de cambios de fechas.

## Experiencia

- La lista de proyectos enfatiza cliente/obra, etiqueta de estado y porcentaje. El proyecto completado se distingue a simple vista del que sigue en curso, sin depender sólo del color.
- En el detalle, un bloque de resumen diferenciado reúne estado, avance, total aceptado, suplementos y total actualizado. Debajo, las partidas de trabajo y sus conceptos aparecen primero en un bloque desplegable, abierto inicialmente para mantener a mano el seguimiento diario. Las ampliaciones quedan después en otro bloque desplegable, cerrado inicialmente y con el número de registros visible; al abrirlo permite revisar entradas por fecha y añadir una nueva dentro de la página.
- Cada suplemento añade un concepto pendiente para poder seguir también su ejecución. El original aceptado no cambia. El reintento de una escritura reutiliza el mismo ID para evitar registrar dos veces el mismo suplemento.
- Una anulación conserva el suplemento y su concepto en el historial, pero los excluye de los importes y del cálculo de progreso; no se editan ni borran suplementos desde el cliente.
- El estado sigue derivándose de las tareas terminadas: pendiente hasta la primera tarea completada, en curso mientras quede trabajo pendiente y completado al terminar todas. Un proyecto completado con trabajo nuevo vuelve a en curso. Los proyectos no se pueden eliminar en v1.
- El botón «Ver progreso» abre una gráfica accesible y adaptable; una tabla asociada ofrece las fechas y porcentajes cuando la gráfica no sea suficiente. Sin conceptos terminados se muestra un estado vacío útil.
- La fecha de un concepto completado puede corregirse; hacerlo cambia el punto de la serie, pero no el porcentaje de avance actual. La fecha de una partida completa se aplica a todos sus conceptos.
- En pantallas estrechas, la acción de completar concepto/partida no provoca saltos al aparecer la fecha; la información exacta se conserva mediante un control compacto y accesible.
- La guía y las FAQs enlazan a rutas reales y usan el vocabulario «Proyectos», «presupuesto aceptado» y «suplemento».

## Alcance técnico

- Ajustar el contador Free y su validación de Firestore para que la conversión no libere cuota y el límite común use las creaciones históricas registradas; tolerar el campo legado `budgetSlotsReleased` sin descontarlo ni incrementarlo.
- Añadir subdocumentos append-only de suplemento y anulación bajo el proyecto. En transacciones se escriben la entrada, su trabajo asociado y el resumen económico/de avance. Las reglas deben validar propiedad, estructura, tamaño, relaciones entre documentos y la inmutabilidad del presupuesto fuente.
- Permitir actualizar la fecha de finalización sólo en tareas ya completadas y recalcular atómicamente el resumen y `completedAt` del proyecto. La gráfica se deriva del detalle cargado y no requiere dependencia de charts ni registros históricos adicionales.
- Mantener `total` del proyecto como total aceptado original; guardar el acumulado de suplementos por separado para poder explicar la evolución y calcular el total actualizado sin perder la base.
- Actualizar navegación inicial, orden de tabs, páginas, tour, ayuda, catálogo base, importador y documentación contractual.

## Criterios de aceptación

- Una cuenta Free puede ocupar como máximo tres espacios entre presupuestos y proyectos; convertir no libera uno, y el cliente y las reglas del servidor coinciden. Premium no cambia.
- Las cuentas Free que ya tengan más de tres creaciones históricas no pierden contenido y no pueden iniciar nuevas creaciones mientras excedan el límite.
- Un presupuesto aceptado convertido no se modifica al añadir un suplemento; original, registro, trabajo añadido, importe actualizado y progreso persisten juntos o no persiste ninguno.
- Reintentar la misma solicitud no duplica la ampliación. Otro usuario no puede leer ni escribir el proyecto o sus suplementos. Los registros suplementarios no se pueden modificar ni borrar desde el cliente.
- Una anulación requiere motivo, es append-only y retira la entrada anulada de los importes y del progreso sin borrar su historial.
- Completar una tarea usa la fecha actual por defecto; editar la fecha de una tarea o partida persiste y mueve su contribución a la fecha correspondiente de la gráfica, sin alterar el avance actual. La gráfica concuerda con el modo de progreso y tiene alternativa accesible.
- La lista y el detalle distinguen estados de forma reconocible y accesible. Añadir/terminar trabajo no aumenta la altura de las filas por insertar fechas largas en móvil.
- El resumen diferencia original aceptado, suplementos e importe actualizado, con cálculo de IVA explicable.
- “Reforma integral” aparece como única biblioteca en el importador de una cuenta existente y crea el catálogo inicial de una cuenta nueva. Sus 30 partidas se ordenan alfabéticamente, y electricidad agrupa sus conceptos eléctricos. Repetir una importación no duplica conceptos ni pisa precios personalizados.
- El tour incluye Proyectos y la FAQ cubre aceptar, convertir y ampliar una reforma con un enlace funcional.
- Reglas probadas en emuladores, flujos del navegador probados con Auth/Firestore emulados y responsive revisado en móvil y escritorio. El usuario autorizó el despliegue de Hosting y reglas para pruebas el 18-10-2026; no se modificaron datos reales de Firestore.

## Límites y riesgos

- No se edita ni sustituye un presupuesto aceptado; la ampliación se añade al proyecto y no modifica el PDF original.
- Los suplementos son registros de empresa; no incluyen firma o aceptación del cliente, facturación, pagos, costes reales, programación de obra ni colaboración multiusuario.
- La política de cuota no se transforma en una cuota por documentos activos: se conserva el comportamiento existente de no devolver cuota al borrar, y se añade que convertir tampoco la devuelve.
- No se cambian importes, categorías ni precios de los catálogos privados ya guardados. Las cuentas existentes importan la base general manualmente cuando lo decidan.
- La gráfica representa la evolución según las fechas actuales de finalización; no pretende ser una auditoría inmutable de cada cambio o reapertura de una tarea.
- El proyecto vive actualmente en Hosting y usa Firestore de producción. Esta ampliación se hará sólo en el worktree y en emuladores; un despliegue posterior requerirá una instrucción expresa.

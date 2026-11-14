# BG-011 — Equipo de obra y agenda de hitos

Estado: sustituido (agenda retirada el 06-11-2026; vigente: [planificación semanal](2026-11-06-bg011-planificacion-semanal-design.md)).

> **Supersedida el 06-11-2026 por decisión del usuario:** se retiró la agenda y el registro de hitos. El alcance vigente de BG-011 conserva sólo el roster, las cuadrillas y las asignaciones snapshot a proyectos. Este documento queda como registro histórico de la propuesta original; el plan vigente es `docs/specs/plans/2026-11-05-bg-011-retirar-agenda.md`.

**Estado histórico:** agenda implementada en el worktree `codex/bg011-equipo-agenda`; después retirada y verificada por petición del usuario. Pendiente integrar únicamente la gestión de equipo.

## Intención

Dar a cada empresa un registro sencillo de las personas que trabajan en sus obras, permitir agruparlas en cuadrillas identificables y asignar personas o cuadrillas a proyectos. Añadir una agenda general que muestre cuándo se completan los capítulos de los proyectos.

La agenda complementa el seguimiento existente de BG-009. No convierte los proyectos en un planificador de visitas ni añade fechas de trabajo futuro.

**Referencia de interacción:** el checkout consultado de Uuma no contiene una implementación de Calendario; la documentación canónica describe una agenda vertical agrupada por día, navegación temporal compacta, referencia de hoy y color como información secundaria. Esta propuesta adopta ese patrón, con las vistas mensual/semanal y la navegación tipo swiper indicadas por el usuario.

## Objetivos

- Registrar y editar personas con un nombre visible y estado activo/inactivo.
- Crear y editar cuadrillas con etiqueta, color de una paleta accesible y una o más personas.
- Permitir que una persona pertenezca a varias cuadrillas.
- Asignar una persona o una cuadrilla a nivel de proyecto, con una copia de la etiqueta, el color y los nombres presentes en el momento de asignar.
- Consultar una agenda común en vistas **Mes** y **Semana**, agrupada verticalmente por día y con proyecto, cliente y capítulo completado.
- Crear el hito en la misma operación que completa el capítulo, para que avance y agenda no diverjan.
- Mantener el acceso privado bajo el propietario de la cuenta y el aislamiento de sesión ya existentes.

## No objetivos

- Cuentas, inicio de sesión o permisos para trabajadores; el propietario de BudGenerator gestiona el equipo.
- Asignar personas a capítulos o partidas concretos.
- Turnos, disponibilidad, planificación de visitas, tareas futuras, duración, horas, costes laborales, nóminas o facturación.
- Notificaciones al trabajador o al cliente.
- Sincronizar los cambios posteriores del equipo con las asignaciones ya guardadas en proyectos.
- Importar en la agenda el historial de capítulos completados antes de activar BG-011. Los hitos empezarán a registrarse desde su publicación.

## Flujo propuesto

1. Desde **Equipo** (ruta secundaria `/team`), el propietario añade, renombra, activa o desactiva personas.
2. Crea una cuadrilla indicando etiqueta, color y personas activas. Una persona puede aparecer en varias cuadrillas.
3. Desde el detalle de un proyecto, asigna personas y/o cuadrillas. La asignación conserva una instantánea de la identidad visible y la composición actuales; retirar una asignación no borra personas ni cuadrillas.
4. Cuando todas las partidas de un capítulo quedan completadas, la misma transacción actualiza el avance y registra el hito. Completar de nuevo una partida sin que haya habido un cambio real no duplica el hito.
5. La ruta secundaria `/agenda`, accesible desde Proyectos, ofrece los modos **Mes** y **Semana**. En móvil se cambia al periodo anterior/siguiente deslizando horizontalmente; en escritorio se usan botones anterior/siguiente. Los hitos se muestran en una agenda vertical agrupada por día, con referencia visual de hoy y acceso rápido a hoy. La semana va de lunes a domingo.
6. La agenda consulta sólo el mes o la semana visibles y pagina periodos con muchos hitos. La fecha puede corregirse desde el control de fecha existente del capítulo y la agenda refleja la corrección.

## Decisiones de v1

- **Persona:** nombre requerido; estado activo/inactivo. No guardar teléfono, correo, salario ni otros datos personales.
- **Cuadrilla:** etiqueta requerida, color de una paleta cerrada y una lista no vacía de IDs de personas. Al crearla debe incluir al menos una persona activa. Una persona puede pertenecer a varias cuadrillas.
- **Cuadrilla con miembros inactivos:** si se desactiva a todos sus miembros, la cuadrilla permanece visible con el aviso «Sin integrantes activos» y no se ofrece para asignar. Se puede volver a asignar al reactivar o añadir a una persona activa; la instantánea sólo incluye integrantes activos.
- **Inactivar:** conserva los registros y permite reactivarlos; los recursos inactivos no se ofrecen para nuevas asignaciones. Las asignaciones existentes son instantáneas y no cambian.
- **Asignación:** se hace a nivel de proyecto, no de capítulo. Cada documento conserva tipo, ID de origen, etiqueta/color visibles y miembros/nombres presentes al asignar. Un cambio posterior del equipo no reescribe proyectos anteriores; retirar y volver a asignar crea una instantánea actualizada.
- **Agenda:** representa hitos de capítulos que pasan a completados. No muestra cada partida ni hitos aún no realizados. Mantiene el evento si el capítulo se reabre; si vuelve a completarse, crea un nuevo hito. Corregir la fecha de finalización actualiza el hito de esa finalización.
- **Vistas de agenda:** `Mes` cubre el mes natural visible y `Semana` cubre de lunes a domingo. Ambas usan grupos verticales por día con hitos y siguen la agenda de Uuma; no son una tabla horaria. El gesto horizontal cambia un periodo por vez en móvil; botones visibles de periodo anterior/siguiente son la alternativa accesible y el control principal en escritorio. `Hoy` vuelve al periodo y fecha actuales.
- **Fecha:** día local `YYYY-MM-DD`, de acuerdo con BG-009; `recordedAt` conserva cuándo se guardó el evento.
- **Historial existente:** no se reconstruye ni se migra. La agenda empieza vacía para los capítulos completados antes de BG-011 y registra transiciones nuevas.
- **Acceso:** sólo la misma cuenta propietaria que ya gestiona el proyecto puede leer o modificar equipo, asignaciones y agenda.
- **Carga de datos:** mantener los stores ligados a la sesión y limpiarlos al cambiar de cuenta; cargar roster y agenda al abrir sus vistas para no convertir el equipo en una dependencia del arranque de todas las sesiones.

## Modelo de datos propuesto

```text
users/{uid}/teamMembers/{memberId}
  id, name, status: 'active' | 'inactive', createdAt, updatedAt

users/{uid}/crews/{crewId}
  id, label, color, memberIds[], status: 'active' | 'inactive', createdAt, updatedAt

users/{uid}/projects/{projectId}/assignments/{assignmentId}
  id, resourceType: 'member' | 'crew', resourceId,
  label, color?, members: [{ id, name }], assignedAt

users/{uid}/projectAgenda/{eventId}
  id, projectId, projectTitle, clientName, workItemId, workItemName,
  completedAt: 'YYYY-MM-DD', recordedAt: ISO string
```

`ProjectWorkItem` añade `latestMilestoneId?` para que una corrección de fecha encuentre el evento correspondiente. El ID de cada hito es único por transición real a completado; la operación genera el ID antes de entrar en la transacción para que los reintentos no creen duplicados.

La agenda consulta `projectAgenda` sólo dentro del rango de fechas visible (`completedAt >= startDate` y `< endDate`), con orden descendente y páginas acotadas. Al cambiar de mes/semana se reemplaza el rango y se reinicia el cursor; no se descarga todo el historial. Los snapshots de asignación evitan que renombrar o inactivar una persona cambie lo que se muestra en una obra existente. No se permite borrar físicamente un hito desde el cliente.

## Integridad y seguridad

- Las reglas Firestore limitan lecturas y escrituras de miembros/cuadrillas al propietario o admin autorizado según el patrón actual.
- Las reglas validan IDs, tipos, tamaños y valores permitidos para estado/color, y no aceptan escrituras de otra cuenta.
- Las reglas para asignaciones confirman el acceso al proyecto propietario; sólo se crean para recursos de esa misma cuenta.
- Los documentos de cuadrilla y asignación se validan bajo el límite de 900.000 bytes UTF-8 para conservar margen ante el límite de Firestore.
- El evento de agenda sólo se crea en la misma escritura atómica que deja completado un capítulo y actualiza el resumen del proyecto. La corrección de fecha sólo puede actualizar el evento que enlaza el capítulo.
- Los cambios en reglas se consideran incompletos hasta pasar pruebas reales contra Firestore Emulator.
- El store nuevo se limpia en cambio de sesión y descarta respuestas tardías según la revisión de sesión existente.

## Criterios de aceptación

- El propietario puede crear, editar, inactivar y reactivar personas y cuadrillas; no se permiten nombres/etiquetas vacíos ni crear una cuadrilla sin integrantes activos.
- Una persona puede pertenecer a más de una cuadrilla y los IDs duplicados no se guardan dos veces en una cuadrilla.
- Sólo miembros y cuadrillas activos se pueden asignar. Una cuadrilla activa puede contener personas inactivas; se permite asignarla si queda al menos una persona activa y la instantánea incluye sólo esas personas activas junto a la etiqueta y el color de la cuadrilla.
- Las asignaciones pueden añadirse y retirarse sin cambiar el snapshot del presupuesto ni el avance económico del proyecto.
- Completar la última partida de un capítulo crea exactamente un hito junto con la actualización de avance; una escritura repetida no duplica eventos.
- Reabrir una partida no elimina un hito histórico. Completar de nuevo el capítulo registra un nuevo hito; corregir la fecha actualizada modifica el hito enlazado.
- La agenda permite alternar entre mes y semana, navega periodos con swipe en móvil y con botones anterior/siguiente en escritorio, resalta hoy y agrupa los hitos por día.
- Al cambiar periodo, la agenda consulta sólo el rango visible, ordena los hitos por fecha descendente y permite cargar páginas adicionales sin duplicados.
- Los hitos y asignaciones no se leen ni escriben entre cuentas; las cargas de una sesión anterior no alteran la sesión actual.
- La interfaz funciona con teclado y en móvil; el color nunca es el único indicador de una cuadrilla.

## Riesgos y límites

- La actualización de avance, capítulo e hito debe permanecer atómica; cualquier separación permitiría una agenda desincronizada.
- Los hitos anteriores al lanzamiento no estarán disponibles en agenda. No se hará una migración implícita de Firestore.
- La paleta de colores debe conservar contraste suficiente en insignias y en estados de foco/selección.
- El gesto horizontal debe tener controles visibles equivalentes, respetar el movimiento reducido y no interferir con el desplazamiento vertical de la agenda.
- Las asignaciones son informativas y no controlan acceso ni confirman que una persona haya trabajado en una partida.

## Estado de implementación — 05-11-2026

Implementado en el worktree aislado `codex/bg011-equipo-agenda`: rutas `/team` y `/agenda`, snapshots de asignación, hitos transaccionales y consultas paginadas por rango. La agenda usa rangos de mes natural o semana lunes–domingo, swipe horizontal en móvil y botones anterior/siguiente en todos los tamaños. Los hitos anteriores no se reconstruyen. Las pruebas focalizadas de Firestore Emulator y navegador están pasando; la integración/despliegue sigue pendiente de revisión.

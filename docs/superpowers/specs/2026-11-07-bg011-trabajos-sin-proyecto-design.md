# Trabajos independientes en planificación semanal

**Estado:** diseño aprobado, implementado y desplegado para pruebas el 07-11-2026.

## Propósito

Permitir que el gerente planifique remates, ajustes y otros trabajos de un día aunque no correspondan a un proyecto activo. El trabajo conserva su propia identidad y asignaciones; si procede, puede enlazarse opcionalmente a un proyecto.

## Situación actual

`/team` muestra en la semana proyectos y sus asignaciones por día. Los cambios diarios son overrides que viven bajo un proyecto. Por ello, un día sin proyecto no admite una asignación que pueda guardarse y volver a consultarse.

## Comportamiento propuesto

1. Cada día de la semana ofrece la acción **Nuevo trabajo**. En desktop aparece en cada columna y en móvil en el detalle del día seleccionado. La acción abre una página secundaria de nuevo trabajo con la fecha de ese día ya elegida.
2. El formulario permite escoger una fecha de trabajo y una o más personas o cuadrillas activas. El título es obligatorio y la descripción optativa, se enlace o no un proyecto. Desde el bloque de asignaciones se puede dar de alta una persona por su nombre sin abandonar el formulario; se guarda activa y queda seleccionada para el trabajo. Si se enlaza un proyecto, su nombre proporciona el contexto y se propone inicialmente como título del trabajo, que se puede ajustar. No ofrece horarios ni control de duración: este planificador es diario.
3. La asignación requiere al menos un recurso. La selección de una cuadrilla usa una instantánea de su etiqueta, color y miembros activos. No se permite duplicar individualmente a un miembro que ya está dentro de una cuadrilla seleccionada para el mismo trabajo.
4. El proyecto es opcional. Se pueden enlazar proyectos pendientes, en curso o completados, sin límite de tiempo tras la finalización. El enlace no cambia el estado, progreso, fecha estimada de fin, presupuesto ni partidas del proyecto; el registro puntual no reabre la obra.
5. Al guardar, el trabajo aparece en la planificación del día, incluso si no hay proyectos esa semana. Si se enlazó un proyecto, la tarjeta ofrece navegación al detalle del proyecto; el trabajo y su asignación siguen existiendo independientemente.
6. El filtro semanal de miembros/cuadrillas incluye los trabajos. Los indicadores de los días cuentan proyectos con equipo y trabajos, no sólo proyectos.
7. Las alertas actuales de doble asignación se extienden a los trabajos: si una misma persona aparece en más de una tarjeta ese día, se indica el conflicto, mostrando el nombre del trabajo o proyecto correspondiente.
8. Una escritura sin conexión no crea una tarjeta optimista que parezca guardada; se aplica el toast de mutaciones offline existente y se conserva el estado previamente consultado.

## Datos y arquitectura

- Añadir el tipo `TeamJob` al dominio de `entities/workforce`, con ID, título (máximo 120 caracteres), fecha local `YYYY-MM-DD`, una lista acotada de snapshots de asignación, `createdAt` y `updatedAt`.
- `projectId` y `projectTitle` son opcionales. Si existe `projectId`, `projectTitle` es el snapshot de presentación; Firestore Rules verifican que el proyecto referenciado exista en la cuenta propietaria. No se impone ventana temporal por estado completado; ninguna escritura del trabajo actualiza el proyecto.
- Guardar metadatos en `users/{uid}/teamJobs/{jobId}` y snapshots en `users/{uid}/teamJobs/{jobId}/assignments/{assignmentId}`. La API consulta los trabajos de las fechas de la semana y sus snapshots; valida sesión, fecha real, título, cantidad de recursos y las referencias a roster/proyecto. Reglas de propietario validan los campos del trabajo y cada snapshot por separado.
- Reutilizar el patrón actual de snapshots de persona/cuadrilla para conservar nombres y composición aunque cambie el roster. El formulario muestra sólo recursos activos.
- Crear trabajo y snapshots en una transacción; integrar carga, mutación y resultado semanal con `memoryResourceCache` y los snapshots offline particionados por UID. Tras crear, actualizar en memoria la semana consultada; al recuperar red, el refresco actual ya vuelve a leer la ruta activa.
- Añadir una ruta autenticada `/team/jobs/new` antes de la ruta general `/team/:view?`, usando `PageHeader` y retorno a `/team?date=YYYY-MM-DD`.

## Alcance

Incluye crear y consultar trabajos independientes, asignaciones snapshot, enlace de proyecto opcional, filtrado semanal y detección de conflictos. No incluye fichaje, duración, costes, partidas, cambios de progreso, reapertura de proyectos, ni gestión de estados de trabajo.

## Criterios de aceptación

- Desde un día sin proyecto se puede abrir el formulario con esa fecha precargada, crear un trabajo con título y recursos y verlo en ese día.
- El trabajo puede guardarse sin proyecto; no exige reabrir ni crear un proyecto.
- Un trabajo enlazado a un proyecto terminado no modifica su estado, progreso, fecha estimada, presupuesto ni partidas.
- El selector permite enlazar proyectos pendientes, en curso y completados sin límite temporal.
- Los filtros de equipo afectan a los trabajos; las tarjetas y alertas no confunden el trabajo independiente con un proyecto activo.
- Las reglas impiden leer o crear trabajos de otra cuenta y rechazan documentos con esquema, fecha, título o snapshots inválidos.
- La agenda vista offline conserva las tarjetas ya consultadas; un intento de crear offline muestra el aviso existente y no se presenta como guardado.

## Decisiones confirmadas

- El usuario confirmó que se pueden hacer registros puntuales vinculados a un proyecto una vez finalizado, sin reabrirlo y sin límite de un mes.
- Si no se enlaza un proyecto, se pide título y se permite dejar la descripción vacía; se mantienen la fecha del día y la asignación de una o más personas/cuadrillas solicitadas anteriormente.

## Revisión

La revisión independiente no encontró decisiones materiales pendientes fuera de la ventana temporal; la última instrucción del usuario confirmó que no debe existir límite tras la finalización.

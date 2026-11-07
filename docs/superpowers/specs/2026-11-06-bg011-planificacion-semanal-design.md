# BG-011 — Planificación semanal

## Intención

Permitir que el gerente vea y ajuste desde Equipo qué personas y cuadrillas van a cada proyecto cada día de una semana. La vista semanal será la entrada principal; la gestión del roster quedará en una página secundaria.

Esta solicitud nueva reintroduce sólo la planificación semanal de recursos. La decisión previa de retirar el calendario de hitos/capítulos sigue vigente.

## Flujo y presentación

- `/team` se integra como tercera tab principal, tras Presupuestos y Proyectos y antes de Solicitudes. Se dedica únicamente a planificar y no muestra tabs internas. Junto al título incluye un botón circular de edición que abre `/team/manage`, página secundaria para gestionar miembros y cuadrillas con retorno al calendario.
- Las tarjetas de proyecto muestran el título a todo el ancho y, debajo, dos acciones circulares con nombre accesible: editar las asignaciones de ese día o usar una flecha hacia la derecha para abrir el detalle.
- La vista muestra una sola semana de lunes a domingo. El encabezado presenta rango, año y controles anterior/siguiente en una fila que no se parte, también a 320 px; se reducen las tipografías y espacios en móvil. No existe cambio a vista mensual.
- En escritorio se muestran los siete días como columnas. Cada día agrupa por proyecto las personas y cuadrillas previstas; una cuadrilla usa su color de fondo y puede mostrar sus integrantes.
- En móvil se selecciona uno de los siete días y se puede arrastrar horizontalmente el calendario; el contenido sigue al dedo y al soltar completa el cambio si se supera el umbral, o vuelve a su sitio si el gesto es corto. El desplazamiento vertical sigue siendo nativo. Los botones anterior/siguiente usan el mismo movimiento, y movimiento reducido quita la transición de asentamiento.
- Las asignaciones existentes de proyectos pendientes o en curso forman el valor inicial de cada día. Se puede añadir cualquier persona/cuadrilla activa y quitar una persona, un miembro de cuadrilla o una cuadrilla para ese día.
- Cada proyecto puede tener una fecha estimada de fin, editable desde su detalle y guardada como fecha local `YYYY-MM-DD`. Si tiene fecha, aparece en el calendario hasta ese día inclusive y deja de aparecer después. Un proyecto antiguo sin fecha sigue visible hasta que se configure; se marca como pendiente de estimación. La fecha no completa el proyecto ni elimina o cambia asignaciones diarias guardadas.
- Un filtro multiselección permite mostrar las asignaciones de una o varias personas y/o cuadrillas. El menú se superpone al calendario sin cambiar su altura, y su lista usa scroll vertical propio con una altura máxima adaptada al viewport. Se combinan como alternativas: se ven proyectos con cualquiera de los recursos elegidos. Si se filtra por una persona incluida en una cuadrilla, se mantiene la tarjeta y el color de la cuadrilla, mostrando sólo la persona coincidente; al filtrar por la cuadrilla se muestra completa.
- Una persona que aparece en más de un proyecto el mismo día genera un aviso de conflicto, pero no se bloquea el guardado.
- `/team/manage` conserva la gestión actual de personas y cuadrillas; el planificador permanece montado al navegar para retener semana y filtro seleccionados.

## Persistencia y límites

- Las excepciones diarias no cambian la asignación general del proyecto. Cada edición guarda un snapshot de las asignaciones efectivas para ese proyecto y fecha.
- `estimatedEndDate` es un campo opcional del documento raíz del proyecto para preservar proyectos históricos sin fecha; no se asignan fechas ni se migran documentos existentes.
- Los snapshots diarios viven en `users/{uid}/projects/{projectId}/dailyAssignments/{YYYY-MM-DD}`. Un día/proyecto sin snapshot deriva sus asignaciones del roster del proyecto; por tanto, cambios al roster permanente sólo afectan a días aún no editados.
- La asignación diaria reutiliza la forma validada de `ProjectAssignment`, incluyendo los miembros snapshot de una cuadrilla. Esto permite excluir a una persona de la cuadrilla sólo en ese día.
- Las lecturas y escrituras quedan limitadas por las reglas al propietario y a proyectos de su cuenta. Sólo se puede escribir un plan para proyectos pendientes o en curso. Un día/proyecto completado previamente se puede consultar, pero no editar.
- Se usan fechas locales `YYYY-MM-DD`; no se añaden franjas horarias ni tareas/hitos de capítulos.

## Fuera de alcance

- Vista mensual, horas por jornada, cambios en asignaciones globales desde el planificador, notificaciones y asignación automática.
- Persistencia del filtro seleccionado entre recargas o navegaciones fuera de la vista semanal.
- Migración de documentos existentes; el roster por proyecto sigue siendo la fuente de los valores iniciales.

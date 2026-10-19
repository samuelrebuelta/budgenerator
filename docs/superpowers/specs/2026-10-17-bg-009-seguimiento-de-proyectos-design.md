# BG-009 — Aceptación de presupuesto y seguimiento del proyecto

## Aclaración de terminología (19-10-2026)

En textos de producto, cada bloque `workItem` se presenta como **capítulo** y sus tareas como **partidas**. El modelo y los campos Firestore existentes (`workItems`, `tasks`, `totalConcepts`, `completedConcepts`) se conservan; esta corrección no cambia datos ni contratos.

**Estado:** base implementada y desplegada para pruebas el 18-10-2026. La extensión aprobada del 18-10-2026 está verificada localmente, pendiente de revisión e integración; no se ha desplegado.
**Diseño:** 2026-10-17. **Resolución de decisiones:** 2026-10-18.

## Intención

Cuando una empresa confirma que el cliente acepta un presupuesto, convertirlo en un proyecto que sirva para controlar el avance real de la reforma. La empresa marcará conceptos o partidas como terminados y verá el estado y porcentaje de avance en su perfil.

## Flujo

1. Desde el detalle del presupuesto, el usuario pulsa **Marcar como aceptado** y confirma la acción. BudGenerator guarda fecha de aceptación.
2. El usuario elige **Convertir en proyecto**. La conversión guarda un snapshot independiente del presupuesto aceptado y un enlace al documento de origen.
3. El proyecto aparece en la lista `/projects`, con cliente, nombre, fecha, estado y avance.
4. En el detalle, el usuario puede marcar o reabrir un concepto; también puede marcar una partida completa, lo que completa sus conceptos. El usuario puede ver el avance de toda la reforma y el de cada partida.

La conversión es idempotente: un presupuesto sólo puede originar un proyecto en esta fase y repetir la acción abre el mismo proyecto en lugar de duplicarlo. No se crea automáticamente al aceptar; la conversión es una decisión explícita.

Propuesta de integridad: mientras esté aceptado, el presupuesto no se podrá editar sin **Retirar aceptación**; esa acción invalida `acceptedAt`. Después de convertirlo, el snapshot se conserva dentro del proyecto y el presupuesto de origen pasa a histórico de sólo lectura; para revisar la oferta se duplica. Así, el proyecto representa la versión aceptada y mantiene su vínculo.

Decisión de cuota de la base, sustituida por la extensión BG-009 aprobada el 18-10-2026: la primera implementación liberaba al convertir la plaza Free del presupuesto, aunque su snapshot permaneciera consultable desde el proyecto. La regla vigente conserva esa plaza al convertir; ver `2026-10-18-bg-009-proyectos-como-core-design.md`.

## Modelo de avance

Cada concepto del snapshot tendrá estado terminado/pendiente y fecha de cambio. El estado de partida se deriva de sus conceptos; el estado del proyecto será **Pendiente** cuando ninguno esté terminado, **En curso** cuando haya trabajo terminado e incompleto, y **Completado** cuando todos los conceptos estén terminados. No se añade estado de pago ni de facturación.

El gráfico principal mostrará importe neto previsto terminado sobre el neto previsto total de conceptos del snapshot, excluyendo IVA y ajustes globales para evitar repartir descuentos entre trabajos. Si falta precio, hay valores no positivos o el denominador no permite ponderar todos los conceptos, se usará porcentaje por cantidad de conceptos. La interfaz debe rotularlo como avance estimado basado en el presupuesto: no mide horas, visitas ni porcentaje físico subjetivo de cada trabajo. Un proyecto sin conceptos terminables no se puede convertir.

## Modelo de datos propuesto

- Al presupuesto se añaden `acceptedAt` y `projectId` opcional.
- `users/{uid}/projects/{projectId}` guarda `sourceBudgetId`, datos de cliente/título, importes totales y fechas de conversión/aceptación como snapshot.
- `users/{uid}/projects/{projectId}/workItems/{workItemId}` guarda la partida y una copia de sus conceptos con estado y fecha de finalización. Mantener una partida por documento facilita cambios sin reescribir el presupuesto ni toda la lista de proyectos.
- La conversión se realiza en un write batch: crear proyecto y partidas, y enlazar el presupuesto. El límite actual de 200 partidas deja margen para el límite de escrituras atómicas de Firestore; el diseño técnico debe verificar tamaño del documento de cada partida.
- El proyecto no depende de lecturas posteriores del catálogo. Editar tarifas, catálogo o presupuesto de origen no reescribe su snapshot.
- En v1, completar un proyecto no lo borra ni lo archiva automáticamente; la lista conserva los proyectos para consulta. La política de archivo/eliminación se deja fuera hasta definir el ciclo de vida.

La ruta `/projects` y los documentos se protegen con las mismas reglas de propietario que presupuestos y plantillas. No se publican proyectos ni datos de avance a clientes.

## Criterios de aceptación

- Sólo una cuenta autorizada puede marcar su presupuesto aceptado y convertirlo; un usuario no accede a proyectos de otra cuenta.
- Dos conversiones repetidas o concurrentes desde el mismo presupuesto no crean duplicados ni dejan el presupuesto sin enlace.
- Marcar/reabrir un concepto actualiza de forma coherente estado, avance de su partida y gráfica del proyecto.
- Marcar una partida completa aplica el cambio a sus conceptos y puede revertirse desde conceptos.
- El total de progreso corresponde al método descrito y el fallback por cantidad funciona con conceptos sin importe.
- Modificar el catálogo o el presupuesto origen después de convertir no cambia el snapshot.
- Probar reglas, conversión duplicada/concurrente, presupuesto grande, partida vacía, concepto sin precio y proyecto ya completado.

## Fuera de alcance

Planificación por calendario, asignación de trabajadores, partes de horas, compras, costes reales, pagos/facturas, mensajes al cliente, colaboración multiusuario, permisos por obra, cronogramas, porcentajes físicos manuales y fusión de varios presupuestos en un proyecto.

## Decisiones v1 resueltas

- La aceptación se puede retirar mientras el presupuesto no se haya convertido. El bloqueo de edición se mantiene mientras esté aceptado.
- La conversión es una acción explícita e idempotente. El snapshot del proyecto es independiente y el presupuesto fuente queda permanentemente en solo lectura; se puede crear una copia editable con IDs nuevos.
- El porcentaje usa importe neto de conceptos, aplicando el redondeo de línea existente y sin IVA ni ajuste global. Si una línea no se puede ponderar, el proyecto completo usa cantidad de conceptos.
- No se persiste historial de cambios de estado en v1; cada concepto conserva su `completedAt` actual y el proyecto su fecha de finalización actual.
- Decisión original de la base, sustituida el 18-10-2026: convertir liberaba una plaza Free y escribía `budgetSlotsReleased` junto al vínculo. La regla vigente mantiene la plaza ocupada y deja de incrementar o descontar ese campo; ver `2026-10-18-bg-009-proyectos-como-core-design.md`.
- Se admiten hasta 200 partidas; cada documento de partida debe quedar por debajo de 900.000 bytes UTF-8. Se rechazan presupuestos sin conceptos terminables y snapshots con IDs vacíos o duplicados.

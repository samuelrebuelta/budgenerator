# BG-009 — Proyectos como núcleo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Convertir Proyectos en la experiencia principal de BudGenerator, con cuota Free compartida, ampliaciones trazables, seguimiento de fechas, catálogo común simplificado y guía actualizada.

**Architecture:** Conservar `totalBudgetsCreated` como contador de plazas ocupadas; la conversión deja de modificar contadores. Añadir suplementos y anulaciones como registros append-only relacionados transaccionalmente con su trabajo y con los resúmenes del proyecto. Derivar la evolución desde las fechas vigentes de los conceptos, renderizar una gráfica accesible sin dependencias, y mantener catálogos privados existentes sin migraciones automáticas.

**Tech Stack:** React 19, TypeScript strict, Zustand, React Router, Tailwind, Firebase Firestore, Vitest, Playwright y Firebase Emulator Suite.

**Spec:** `docs/superpowers/specs/2026-10-18-bg-009-proyectos-como-core-design.md`

## Restricciones globales

- Una cuenta Free dispone de tres plazas compartidas; `totalBudgetsCreated` es el contador autoritativo y `budgetSlotsReleased` sólo se tolera por compatibilidad histórica.
- Un proyecto conserva inmutable el presupuesto aceptado original y sus importes originales.
- Cada suplemento crea trabajo pendiente; las anulaciones requieren motivo y conservan el historial original.
- Las escrituras de Firestore validan propietario, vínculos y estructura; las operaciones relacionadas se guardan atómicamente.
- La gráfica usa las fechas actuales de finalización, se adapta a móvil y ofrece alternativa accesible.
- Mantener TypeScript estricto, UI y documentación en español, identificadores en inglés y cero dependencias nuevas.
- No modificar documentos reales de Firestore. El usuario autorizó el despliegue de Hosting y reglas a `budgenerator` para pruebas después de completar las verificaciones.

## Foco de revisión

- **Cuentas Free con historial por encima de 3:** conservar presupuestos/proyectos y bloquear nuevas creaciones; premium mantiene el acceso. Cubrir en `budgetQuota.test.ts` y reglas.
- **Reintentos de suplemento/anulación:** un mismo ID estable no crea líneas o anulaciones duplicadas. Cubrir en pruebas unitarias y de emulador.
- **Transacciones solapadas:** alta o anulación simultánea no desajusta totales ni progreso. Cubrir en pruebas de API con emulador.
- **Fechas y zonas locales:** el selector no desplaza el día al guardar; una fecha corregida mueve el punto del gráfico y no altera el avance actual. Cubrir con pruebas del cálculo y E2E en fecha local.
- **Proyectos sin conceptos terminados, importes no ponderables o suplementos anulados:** mantener estado y gráfica coherentes y accesibles. Cubrir con pruebas de modelo y E2E.

---

### Tarea 1: Cuota Free compartida y conversión

**Archivos:**

- Modificar: `src/shared/lib/utils.ts`
- Modificar: `src/entities/user/model/store.ts`
- Modificar: `src/entities/budget/api/firestore.ts`
- Modificar: `src/entities/project/api/firestore.ts`
- Modificar: `src/shared/ui/BudgetLimitReached.tsx`
- Modificar: `firestore.rules`
- Prueba: `tests/budgetQuota.test.ts`
- Prueba: `tests/projectConversion.rules.test.ts`
- Prueba: `tests/security.rules.test.ts`

**Interfaces:**

- `getBudgetSlotsUsed(totalBudgetsCreated: number): number` devuelve las creaciones históricas sin descontar el contador legado; los llamadores dejan de pasar `budgetSlotsReleased`.
- `canCreateBudget(userData)` y la API de creación aplican Free `< 3`; premium mantiene su excepción actual.
- La conversión actualiza sólo el presupuesto y el proyecto; no incrementa `budgetSlotsReleased` ni escribe un contador nuevo en el usuario.

- [x] Escribir `counts all created budgets despite legacy releases`, `blocks a fourth free budget`, y `keeps premium creation unrestricted`; cubrir 0, 2, 3 y más de 3 creaciones.
- [x] Ejecutar `pnpm test -- tests/budgetQuota.test.ts`; confirmar fallo porque el contador legado todavía se resta.
- [x] Escribir prueba de reglas que permita convertir un presupuesto ya contabilizado sin tocar la cuota y rechace la cuarta creación Free.
- [x] Ejecutar la prueba de reglas en el emulador y confirmar el fallo esperado.
- [x] Cambiar la utilidad, la validación del cliente, la transacción de conversión y las reglas para ignorar el campo legado y validar la plaza con `totalBudgetsCreated`.
- [x] Ejecutar `pnpm test -- tests/budgetQuota.test.ts tests/projectConversion.test.ts` y `pnpm test:rules`; confirmar cuota consistente en cliente y servidor.

### Tarea 2: Proyectos como inicio y estados visibles

**Archivos:**

- Modificar: `src/app/router.tsx`
- Modificar: `src/app/AppShell.tsx`
- Crear: `src/entities/project/ui/ProjectStatusTag.tsx`
- Modificar: `src/entities/project/index.ts`
- Modificar: `src/pages/projects/ProjectsPage.tsx`
- Modificar: `src/pages/project-detail/ProjectDetailPage.tsx`
- Modificar: componentes de proyecto existentes en `src/pages/projects/`
- Prueba: `tests/e2e/app.spec.ts`

**Interfaces:**

- `/` redirige a `/projects`; Proyectos es la primera pestaña y el enlace de marca lleva a esa ruta.
- Los estados pendiente, en curso y completado reutilizan el mismo componente/tag accesible en lista y detalle.
- El resumen de proyecto tiene un bloque visual distinto de partidas y conceptos.

- [x] Añadir `opens projects from the root`, `places projects first in navigation`, `shows a status tag in list and detail`, y `separates project summary from work items` en `tests/e2e/app.spec.ts`.
- [x] Ejecutar el flujo E2E focalizado y confirmar que falla con el orden/rutas/estilos actuales.
- [x] Implementar navegación y composición visual respetando el sistema actual petróleo/papel/terracota.
- [x] Ejecutar el flujo focalizado en escritorio y móvil; verificar etiquetas y navegación por teclado.

### Tarea 3: Suplementos, anulaciones e importes actualizados

**Archivos:**

- Modificar: `src/entities/project/model/types.ts`
- Modificar: `src/entities/project/api/firestore.ts`
- Modificar: `src/entities/project/model/store.ts`
- Modificar: `src/entities/project/model/progress.ts`
- Modificar: `src/pages/project-detail/ProjectDetailPage.tsx`
- Modificar: `firestore.rules`
- Prueba: `tests/projectSupplement.test.ts` (crear)
- Prueba: `tests/projectSupplement.rules.test.ts` (crear)
- Prueba: `tests/projectProgress.test.ts`

**Interfaces:**

- Añadir `ProjectSupplement` y `ProjectSupplementVoid`; cada anulación se guarda en `users/{uid}/projects/{projectId}/supplementVoids/{supplementId}` y no reemplaza el suplemento original.
- `NewProjectSupplement` contiene `description: string`, `quantity: number`, `unit: string` y `unitPrice: number`. `ProjectSupplement` añade `id`, `vatRate`, `subtotal`, `iva`, `total`, `createdAt` y `workItemId`. `ProjectSupplementVoid` contiene `supplementId`, `reason` y `voidedAt`.
- El API expone `addSupplement(uid: string, projectId: string, supplementId: string, input: NewProjectSupplement): Promise<{project: Project; supplement: ProjectSupplement; workItem: ProjectWorkItem}>` y `voidSupplement(uid: string, projectId: string, supplementId: string, reason: string): Promise<{project: Project; supplementVoid: ProjectSupplementVoid; workItem: ProjectWorkItem}>`; el cliente conserva el ID estable para reintentos idempotentes.
- Los documentos viven bajo `users/{uid}/projects/{projectId}/supplements/{supplementId}` y `supplementVoids/{supplementId}`. La tarea de trabajo usa ID determinista `supplement_{supplementId}`.
- `Project` guarda `supplementsSubtotal`, `supplementsIva` y `updatedTotal`; `subtotal`, `iva` y `total` mantienen los valores aceptados. Una partida anulada conserva `voidedAt` en su documento de trabajo y se excluye de los agregados activos.
- Una ampliación crea un `ProjectWorkItem` relacionado con el suplemento y una tarea pendiente. Los campos originales `subtotal`, `iva` y `total` no cambian; los resúmenes nuevos separan suplemento neto, IVA de suplementos y total actualizado.
- Una anulación requiere motivo, registra un documento una sola vez y excluye ese trabajo de importe, progreso y estado activo.

- [x] Escribir `adds supplement with source VAT and no second adjustment`, `retries the same supplement ID once`, y `voids a supplement with reason and removes its amount and work from progress`.
- [x] Ejecutar `pnpm test -- tests/projectSupplement.test.ts`; confirmar fallos por tipos/API inexistentes.
- [x] Escribir pruebas de reglas para propietario, estructura, inmutabilidad, vínculo suplemento-trabajo y anulación atómica; otro usuario y escrituras parciales deben fallar.
- [x] Ejecutar las pruebas de reglas en emulador y confirmar los rechazos previstos.
- [x] Implementar tipos y transacciones; recalcular los agregados de trabajo y estado en la misma transacción; no alterar el presupuesto fuente.
- [x] Añadir resumen original/suplementos/total actualizado y sección de ampliaciones al detalle; permitir registrar y anular con motivo.
- [x] Ejecutar pruebas unitarias, API y de reglas; confirmar idempotencia, importes y progreso tras alta/anulación, incluso en proyecto completado.

### Tarea 4: Fechas editables y gráfica de evolución

**Archivos:**

- Crear: `src/entities/project/model/history.ts`
- Crear: `src/pages/project-detail/ProjectTaskCompletionDate.tsx`
- Modificar: `src/entities/project/model/types.ts`
- Modificar: `src/entities/project/api/firestore.ts`
- Modificar: `src/entities/project/model/store.ts`
- Modificar: `src/pages/project-detail/ProjectDetailPage.tsx`
- Crear: `src/pages/project-detail/ProjectProgressHistoryDialog.tsx`
- Prueba: `tests/projectProgressHistory.test.ts` (crear)
- Modificar: `tests/projectStore.test.ts`
- Modificar: `tests/projectConversion.rules.test.ts`
- Prueba: `tests/e2e/app.spec.ts`

**Interfaces:**

- `calculateProjectProgressHistory(workItems: ProjectWorkItem[], mode: ProjectProgressMode): ProjectProgressHistoryPoint[]` devuelve puntos por día con `date: string`, `percent: number` y `completedConcepts: number` para el gráfico y la tabla accesible.
- `ProjectProgressHistoryPoint.date` es la clave local `YYYY-MM-DD`; los puntos se agrupan y ordenan cronológicamente.
- El API expone `setTaskCompletionDate(uid, projectId, workItemId, taskId, completedAt: string)` y `setWorkItemCompletionDate(uid, projectId, workItemId, completedAt: string)`; sólo admiten tareas ya completadas y rechazan fechas futuras.
- Al marcar tarea/partida se conserva la fecha actual por defecto. La fecha de una partida completa se asigna a todos sus conceptos.
- Cambiar fechas recalcula `completedAt` del proyecto como la fecha máxima de sus tareas cuando todas están terminadas; reabrir una tarea la elimina del cálculo.

- [x] Escribir `groups completed tasks by local day`, `weights amount and concept modes`, `moves a point when completion date changes`, `excludes reopened and voided tasks`, y `returns no points for an empty project`.
- [x] Ejecutar `pnpm test -- tests/projectProgressHistory.test.ts`; confirmar fallo por helper inexistente.
- [x] Escribir `persists completion date and recalculates project completion date`, `applies one date to every task in a completed work item`, y `rejects a future completion date` en pruebas de API/store.
- [x] Añadir una prueba que intente guardar una fecha futura y confirme que el API la rechaza sin cambiar trabajo ni resumen.
- [x] Confirmar que las escrituras usan el acceso autenticado del proyecto y que el API sólo las ofrece para trabajo ya completado.
- [x] Ejecutar las pruebas del emulador y confirmar que la edición propia funciona y una edición de otra cuenta se deniega; el API rechaza fechas pendientes y futuras.
- [x] Implementar helper, transacciones y selector de fecha; agrupar la gráfica por día según zona local sin cambiar el porcentaje vigente.
- [x] Añadir botón «Ver progreso» que abre una vista accesible con gráfica SVG y tabla equivalente; incluir estado vacío sin conceptos terminados y bloquear fechas futuras.
- [x] Añadir E2E: marcar con fecha actual, corregir fecha de concepto/partida, comprobar movimiento del punto y que el avance actual no cambie.
- [x] Ejecutar pruebas focalizadas y E2E responsive; revisar el control compacto en 320, 390, 430 y 1440 px, y la gráfica en 390 px.

### Tarea 5: Catálogo general importable y familias de trabajo

**Archivos:**

- Modificar: `src/entities/catalog/model/baseCatalogs.ts`
- Modificar: `src/entities/catalog/model/store.ts`
- Modificar: selector/modal de importación bajo `src/pages/catalogs/components/`
- Prueba: `tests/catalogTradeImport.test.ts`
- Modificar: pruebas de store/importación existentes bajo `tests/`
- Modificar: `tests/e2e/app.spec.ts`

**Interfaces:**

- “Reforma general” es una base importable para cuentas existentes y la semilla para nuevas cuentas.
- `TRADE_CATALOGS` incluye “Reforma general” y mantiene los catálogos especializados; `en_blanco` sigue excluido.
- La base general expone ocho familias: Demolición y residuos; Albañilería y tabiquería; Suelos y revestimientos; Pintura; Electricidad; Fontanería y sanitarios; Carpintería; Servicios auxiliares.

- [x] Escribir pruebas de inclusión de “Reforma general”, exclusión de “En blanco”, ocho familias y agrupación eléctrica de circuitos/enchufes/iluminación.
- [x] Ejecutar `pnpm test -- tests/catalogTradeImport.test.ts`; confirmar fallo con el catálogo importable actual.
- [x] Añadir pruebas de importación repetida, deduplicación y preservación de precios privados.
- [x] Simplificar la base y la importación de electricidad sin borrar catálogos de oficio ni migrar datos guardados.
- [x] Ejecutar las pruebas del catálogo y un E2E de importación/semilla en cuenta con catálogo existente y cuenta sin catálogo.

### Tarea 6: Guía, FAQ, contratos y cierre

**Archivos:**

- Modificar: `src/features/app-tour/AppTour.tsx`
- Modificar: `src/pages/help/helpContent.ts`
- Modificar: `docs/plan.md`
- Modificar según las áreas cambiadas: `docs/product.md`, `docs/architecture.md`, `docs/firebase.md`, `docs/state-and-cache.md`, `docs/styles-and-responsive.md` y `docs/specs/BG-008-catalogo-unico-y-creacion-guiada.md`.
- Capturas: `docs/testing-evidence/`

- [x] Añadir Proyectos como primera parada del tour, explicar aceptación y conversión desde un presupuesto y cubrir suplementos, total revisado y evolución por fecha en FAQ con enlaces comprobables.
- [x] Añadir `explains project acceptance, supplements, and progress history in help` y `new registrations include the project-first tour and allow replay` en `tests/e2e/app.spec.ts`.
- [x] Actualizar contratos y `docs/plan.md` con el comportamiento implementado, sin declarar verificados checks todavía no ejecutados.
- [x] Ejecutar verificaciones focalizadas y, para cerrar, `pnpm test`, `pnpm test:rules`, `pnpm test:e2e`, `pnpm lint`, `pnpm build` y `pnpm format:check`.
- [x] Probar reglas sólo en emuladores; revisar evidencia responsive. No desplegar ni modificar datos de producción.
- [x] Registrar en `docs/plan.md` resultados exactos y pendientes, incluyendo el estado de la prueba física PWA.

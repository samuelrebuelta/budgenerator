# Catálogo con partidas y conceptos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar el catálogo y el flujo de presupuesto bajo partidas con conceptos, manteniendo presupuestos/plantillas anteriores como snapshots editables.

**Architecture:** Persistir partidas anidadas en el documento de catálogo existente y migrar en lectura el formato plano de tarifas. Los editores de presupuesto y plantilla conservan sus snapshots actuales; sus selecciones y sugerencias proceden de IDs de partida/concepto del catálogo.

**Tech Stack:** React, TypeScript strict, Zustand, Firebase Firestore, Vitest, Firebase Emulator y Playwright existentes.

**Spec:** `docs/superpowers/specs/2026-10-17-catalogo-partidas-conceptos-design.md`

## Global Constraints

- No dependencias nuevas ni cambios a reglas salvo necesidad demostrada y cubierta por emulador.
- No borrar ni reescribir en lote presupuestos, plantillas o datos de otras cuentas.
- Mantener cálculos, exportación PDF, enlaces públicos y snapshots anteriores.
- UI y documentación en español; identificadores de código en inglés.
- Mantener el catálogo en `users/{uid}/tariffCatalogs/main-v1` y respetar el límite de 1 MiB.

## Review Focus

- Catálogo legado sin partidas/metadatos o con categorías repetidas: test de conversión agrupada e idempotente en `tests/catalogStore.test.ts` y `tests/catalog.rules.test.ts`.
- Presupuesto/plantilla con partida que ya no existe en catálogo: test de snapshot legible y editable en `tests/budgetStore.test.ts` y E2E.
- Dos conceptos con texto/unidad iguales en partidas distintas: test de identidad y sugerencias por ID/partida en `tests/budgetStructure.test.ts`.
- Reintento de migración con destino canónico presente: test de preservación del destino y agrupación no destructiva.
- Buscar, seleccionar y quitar conceptos en vista estrecha o tras retroceder: E2E de asistente/editor existente.

---

### Task 1: Modelo de catálogo y compatibilidad Firestore

**Files:**

- Modify: `src/shared/types/index.ts`
- Modify: `src/entities/catalog/model/catalog.ts`
- Create: `src/entities/catalog/model/migrate.ts`
- Modify: `src/entities/catalog/model/baseCatalogs.ts`
- Modify: `src/entities/catalog/model/search.ts`
- Modify: `src/entities/catalog/api/firestore.ts`
- Modify: `src/entities/catalog/model/store.ts`
- Test: `tests/catalogStore.test.ts`
- Test: `tests/catalogSearch.test.ts`
- Test: `tests/catalog.rules.test.ts`

**Interfaces:**

- Produce `CatalogPart { id: string; name: string; concepts: Tariff[] }` and `TariffCatalog.parts: CatalogPart[]`.
- Persist concepts without a category field; their parent `CatalogPart` supplies membership. Keep the existing flat `Tariff` shape as a derived client view during the UI transition.
- Keep selectors `getTariffById`, part helpers and search APIs coherent with part IDs.
- Adapter reads both `parts` and legacy `tariffs[].category`, and writes only the nested format after idempotent grouping.

- [x] Write failing tests for legacy grouping, deterministic part IDs, preservation of destination, nested search and same-text concepts in different parts.
- [x] Run targeted catalog tests and confirm they fail for missing nested-model behavior.
- [x] Implement nested catalog types, base data, searches, store and backward-compatible Firestore mapping.
- [x] Run catalog unit and emulator tests; verify old catalog values map losslessly and a second load does not regroup or overwrite.

### Task 2: Catalog editing by partida

**Files:**

- Modify: `src/pages/catalogs/CatalogDetailPage.tsx`
- Modify: `src/pages/catalogs/catalogSummary.ts`
- Modify: `src/entities/catalog/model/store.ts`
- Modify: `src/entities/catalog/index.ts`
- Test: catalog UI tests if present, otherwise `tests/e2e/app.spec.ts`

**Interfaces:**

- Catalog store exposes actions to create/rename/delete a part and add/edit/remove a concept under a part ID.
- Existing price/unit editing remains; no concept is moved by matching its display text.

- [x] Add tests for part rename retaining concept membership and part-scoped add/remove.
- [x] Implement catalog screens as a hierarchy with search and Spanish alphabetical sorting.
- [x] Verify empty part/catalog states, existing legacy conversion and responsive catalog editor.

### Task 3: Budget and template selectors use catalog parts

**Files:**

- Modify: `src/features/budget-editor/ui/AddWorkItemButton.tsx`
- Modify: `src/features/budget-editor/ui/AddTaskButton.tsx`
- Modify: `src/features/budget-editor/ui/CatalogSelector.tsx`
- Modify: `src/features/budget-editor/ui/BudgetEditor.tsx`
- Modify: `src/entities/budget/model/store.ts`
- Modify: `src/entities/budget/api/firestore.ts`
- Modify: template editor paths discovered by `rg` for add-part/add-concept controls
- Test: `tests/budgetStore.test.ts`, `tests/e2e/app.spec.ts`

**Interfaces:**

- Catalog-backed part selection uses `CatalogPart.id`; the existing manually named snapshot option remains available as an explicit custom partida.
- Selecting/applying a catalog concept copies its values into the budget snapshot and records optional source IDs.
- Existing `workItems/tasks` snapshots remain readable and editable without requiring current catalog membership.

- [x] Add failing tests that the normal catalog-backed partida chooser reflects actual catalog parts, not `RENOVATION_CATEGORIES`.
- [x] Add failing tests for copying N concepts into a selected part and editing/removing copied snapshots without changing catalog values.
- [x] Implement catalog-backed selectors and source IDs while preserving old snapshot fields and custom editing.
- [x] Run budget store tests and targeted template/budget E2E, including stale catalog entries.

### Task 4: Guided structure and usage ranking by stable identity

**Files:**

- Modify: `src/features/budget-structure/model.ts`
- Modify: `src/features/budget-structure/BudgetStructureButton.tsx`
- Modify: `src/entities/budget/model/store.ts`
- Test: `tests/budgetStructure.test.ts`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**

- Selection stores part IDs and concept IDs, not category strings.
- `structureFromSelection(parts, selectedPartIds, selectedConceptIds)` returns budget snapshots with copied values and source IDs.
- Ranking prefers catalog concept IDs and falls back for historic rows to normalized part name, description and unit.

- [x] Add failing tests for part identity, duplicate descriptions in separate parts, legacy-history fallback, selection persistence and one-shot confirmation.
- [x] Implement ID-based filtering, review, ordering and ranking.
- [x] Verify current concepts are grouped beneath exactly their catalog part and no empty parts are committed.

### Task 5: Contract updates and complete verification

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/firebase.md`
- Modify: `docs/state-and-cache.md`
- Modify: `docs/testing.md`
- Modify: `docs/plan.md`
- Modify: `docs/superpowers/specs/2026-10-17-catalogo-partidas-conceptos-design.md`
- Modify: relevant tests and fixtures

- [x] Run focused tests, then `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm build` and `pnpm format:check`.
- [x] Inspect the final diff for preserved historical budget/template/public shapes, storage size risks and account isolation.
- [x] Record only executed results and leave deployment/physical PWA checks clearly marked as pending.

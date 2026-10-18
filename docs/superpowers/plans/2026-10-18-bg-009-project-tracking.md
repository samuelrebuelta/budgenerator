# BG-009 Project Tracking Implementation Plan

> **For agentic workers:** Use the executing-plans workflow to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Let an owner accept a budget, convert it once into an independent project snapshot, and track completion by concept and work item.

**Architecture:** Add a `project` entity with Firestore persistence and a session-scoped Zustand store. Keep the accepted budget as a read-only source, create project and work-item snapshots atomically, and maintain progress summaries on the project document so `/projects` does not fan out reads. Protect ownership and the conversion/quota link in Firestore rules.

**Tech Stack:** React 19, TypeScript strict, Zustand, React Router, Firebase Firestore, Vitest, Playwright, Firebase emulators.

**Spec:** `docs/superpowers/specs/2026-10-17-bg-009-seguimiento-de-proyectos-design.md`

## Global Constraints

- Preserve the accepted budget and project snapshot independently; catalog or source edits must not alter a converted project.
- Store each project's work item in `users/{uid}/projects/{projectId}/workItems/{workItemId}`.
- Use an atomic operation and a stable source link so retries cannot create duplicate projects or release quota twice.
- Project reads and writes use the existing owner/admin authorization model; never publish project progress.
- Keep the current Free limit of three budget slots. A converted budget releases one slot while `totalBudgetsCreated` remains a lifetime counter.
- Keep v1 free of payment, invoice, calendar, labor, purchase, client collaboration, and manual physical-progress features.
- Spanish UI and documentation; English identifiers; no new dependencies or production data changes.

## Review Focus

- Empty or incomplete accepted budgets: refuse acceptance/conversion using the existing publish validation and return a Spanish error.
- No terminable concepts (for example, a budget made only of empty work items): refuse conversion without leaving partial records.
- Missing, zero, or non-positive line amounts: select the concept-count progress fallback for the whole project.
- Concurrent/retried conversion of one source: return the same project and release one Free slot exactly once.
- Work-item snapshots at or above 900,000 UTF-8 bytes and projects owned by another account: reject before partial writes and deny reads/writes in emulator rules.

---

### Task 1: Project snapshot and progress model

**Files:**

- Create: `src/entities/project/model/types.ts`
- Create: `src/entities/project/model/progress.ts`
- Test: `tests/projectProgress.test.ts`
- Modify: `src/shared/types/index.ts`

**Interfaces:**

- `ProjectTask` extends `BudgetTask` with optional `completedAt: string`.
- `ProjectWorkItem` contains `id`, `name`, optional `catalogPartId`, and `tasks: ProjectTask[]`.
- `ProjectStatus` is `'pending' | 'in_progress' | 'completed'`; `ProjectProgressMode` is `'amount' | 'concepts'`.
- `calculateProjectProgress(workItems)` returns mode, total/completed concept counts, total/completed net line amounts, integer percent, and status.
- Add optional `acceptedAt` and `projectId` to `Budget`; add optional `budgetSlotsReleased` and `lastConvertedBudgetId` to `UserData` for existing-account compatibility.

- [x] Write tests for empty snapshots, partial/completed states, amount weighting without adjustment/IVA, and count fallback when any line cannot be weighted.
- [x] Run `pnpm test -- tests/projectProgress.test.ts`; confirm the expected missing-module failure.
- [x] Implement the model and calculator using `taskAmount(task)` for each unadjusted line; round the displayed progress percent to an integer.
- [x] Run the targeted test and confirm all cases pass.

### Task 2: Acceptance, atomic conversion, and quota integrity

**Files:**

- Create: `src/entities/project/api/firestore.ts`
- Create: `src/entities/project/model/conversion.ts`
- Create: `src/entities/budget/api/acceptance.ts`
- Create: `src/entities/budget/model/serialization.ts`
- Modify: `src/entities/budget/api/firestore.ts`
- Modify: `src/entities/user/model/store.ts`
- Modify: `src/entities/user/api/firestore.ts`
- Modify: `firestore.rules`
- Test: `tests/projectConversion.test.ts`
- Test: `tests/projectConversion.rules.test.ts`
- Test: `tests/security.rules.test.ts`

**Interfaces:**

- `createBudgetAcceptanceApi(database)` exposes `acceptBudget(uid, budgetId, acceptedAt)` and `withdrawBudgetAcceptance(uid, budgetId)` without initializing Firebase app singletons in emulator tests.
- `convertBudgetToProject(uid, budgetId)` returns the existing or newly created `projectId`; it validates the accepted source, source snapshot, 200-work-item limit, per-work-item document size, and at least one terminable concept before writes.
- `prepareProjectSnapshot(budget, projectId, convertedAt)` builds the immutable parent and work-item snapshots and rejects an individual work-item document at or above 900,000 UTF-8 bytes.
- `createProjectFirestoreApi(database)` exposes the production conversion operation and allows emulator tests to use an authenticated Firestore client.
- Budget serialization lives in a pure model module so conversion can read both current and legacy budget shapes without importing application Firebase singletons.
- Conversion atomically creates the project and work-item snapshots, links `budget.projectId`, and increments `budgetSlotsReleased` plus `lastConvertedBudgetId` once.
- `canCreateBudget()` uses `totalBudgetsCreated - (budgetSlotsReleased ?? 0)` while preserving the lifetime creation counter.

- [x] Add pure and emulator tests for acceptance state transitions, conversion snapshot independence, quota release, duplicate and concurrent conversion, and size/empty-part rejection.
- [x] Run `pnpm test -- tests/projectConversion.test.ts`; verify expected missing-module failure.
- [x] Run the targeted Vitest files against the rules emulator; verify each new rule test fails for the intended authorization or integrity reason.
- [x] Implement transaction and rules changes, including source-budget immutability after conversion and no editing/deleting while accepted.
- [x] Run targeted tests; verify owner isolation, paired source/project link, and exactly-once quota release.

### Task 3: Session project store and progress updates

**Files:**

- Create: `src/entities/project/model/store.ts`
- Create: `src/entities/project/index.ts`
- Modify: `src/app/session.ts`
- Test: `tests/projectStore.test.ts`

**Interfaces:**

- The store exposes `projects`, `activeProject`, `loaded`, `loadProjects(uid)`, `loadProject(uid, projectId)`, `toggleTask(projectId, workItemId, taskId)`, and `completeWorkItem(projectId, workItemId)`.
- Each progress mutation updates the work-item and project summary atomically, recalculates project status/progress, and applies local state only for the current session revision.
- Session reset clears all project state; session loading fetches summaries once per UID.

- [x] Add tests for toggling/reopening a concept, completing a whole work item, summary consistency, and stale-session responses.
- [x] Run the targeted project store tests and confirm they fail before implementation.
- [x] Implement store/API calls using the existing session revision and error conventions.
- [x] Run targeted tests and the budget/store regression tests.

### Task 4: Acceptance and project experience

**Files:**

- Create: `src/pages/projects/ProjectsPage.tsx`
- Create: `src/pages/projects/index.ts`
- Create: `src/pages/project-detail/ProjectDetailPage.tsx`
- Create: `src/pages/project-detail/index.ts`
- Modify: `src/pages/budget-detail/BudgetDetailPage.tsx`
- Modify: `src/pages/budgets/BudgetsPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/AppShell.tsx`
- Test: `tests/e2e/app.spec.ts`

**Behavior:**

- `/projects` lists client, title, acceptance/conversion date, status, and accessible progress; `/projects/:projectId` shows overall and per-work-item progress with concept complete/reopen actions.
- Budget detail confirms **Marcar como aceptado**, offers **Retirar aceptación** before conversion, and confirms **Convertir en proyecto**. A converted source is read-only and links to its project; **Crear copia** starts a new editable budget with new document/task IDs.
- Users can complete an entire work item; reopening individual concepts recalculates its state. There is no payment state or project deletion/archive control in v1.
- Add Projects to desktop and mobile navigation and follow existing detail-page shell behavior.

- [x] Add E2E coverage for accept, withdraw, convert, repeat conversion, progress updates, source immutability, and duplicate-to-edit.
- [x] Run the targeted E2E flow and verify each state is visible and keyboard reachable; native controls remain touch-operable at mobile sizes.
- [x] Implement pages and actions in Spanish using existing shell, PageHeader, Button, Card, ConfirmModal, and progress styles.
- [x] Run targeted E2E tests and review screenshots at 320, 390, 430, and desktop widths.

### Task 5: Contract updates and close-out verification

**Files:**

- Modify: `docs/plan.md`
- Modify: `docs/architecture.md`
- Modify: `docs/firebase.md`
- Modify: `docs/state-and-cache.md`
- Modify: `docs/styles-and-responsive.md`
- Modify: `docs/superpowers/specs/2026-10-17-bg-009-seguimiento-de-proyectos-design.md`

- [x] Record the resolved v1 decisions and actual persisted fields, routes, quota semantics, and validation behavior.
- [x] Run targeted checks, `pnpm test`, `pnpm test:rules`, `pnpm test:e2e`, `pnpm lint`, `pnpm build`, and `pnpm format:check`.
- [x] Update `docs/plan.md` with only the checks actually run and the remaining physical-PWA limitation.

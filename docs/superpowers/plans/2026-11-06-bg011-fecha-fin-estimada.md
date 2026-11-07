# BG-011 Estimated Project End Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a manager set a project's estimated end date and stop showing that project in the weekly staffing calendar after that local date.

**Architecture:** Store an optional local `YYYY-MM-DD` field on the project summary document. The project detail provides the editor, and the weekly planner applies an inclusive end-date check to each day without changing saved daily assignments or project status. Existing projects without a date remain visible until the manager sets one; no production migration is part of this work.

**Tech Stack:** React, TypeScript, Zustand, Firebase Firestore and Rules, Vitest, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-06-bg011-planificacion-semanal-design.md`

## Global Constraints

- Dates are local `YYYY-MM-DD` values and must not shift by timezone.
- The estimated end date is inclusive: the project appears on that date and is hidden on later dates.
- Projects without an estimated end date keep their existing calendar behavior until configured.
- An end date never completes a project or changes its progress, status, assignments, or saved daily overrides.
- Firestore clients may change only `estimatedEndDate` through this operation; ownership and account access rules remain in force.
- Do not migrate or write production data. Do not commit or merge this worktree.
- Deploy Rules and Hosting only after Emulator Rules tests pass; this work continues the user's explicit BG-011 deployment instruction.

## Review Focus

- An end date itself remains visible; the following local day does not. Verify in the model and browser tests.
- Impossible dates such as `2026-02-30` are rejected by the client API. Verify in the date-model test.
- A previous saved daily assignment after the estimate is hidden but remains stored. Verify calendar behavior without deleting or rewriting the override.
- Another account and updates that change status/progress together with the date are denied. Verify with Rules Emulator tests.
- Existing projects missing the field remain visible, preserving current schedules. Verify a legacy fixture in the model/browser test.

---

### Task 1: Project date model and secure persistence

**Files:**

- Create: `src/entities/project/model/estimatedEndDate.ts`
- Modify: `src/entities/project/model/types.ts`, `src/entities/project/model/dailyAssignments.ts`, `src/entities/project/index.ts`, `src/entities/project/api/firestore.ts`, `src/entities/project/model/store.ts`, `firestore.rules`
- Test: `tests/projectEstimatedEndDate.test.ts`, `tests/projectEstimatedEndDate.rules.test.ts`, `tests/projectStore.test.ts`

**Interfaces:**

- `normalizeEstimatedEndDate(value: string): string` validates a real local calendar date and returns the same `YYYY-MM-DD` key.
- `isOnOrBeforeEstimatedEndDate(dateKey: string, estimatedEndDate?: string): boolean` returns true for legacy projects with no estimate and for dates through the inclusive estimate; returns false after it.
- `Project.estimatedEndDate?: string` stores the optional date on list and detail summaries.
- `createProjectFirestoreApi.setEstimatedEndDate(uid: string, projectId: string, date: string): Promise<void>` persists the normalized date under the caller's UID.
- `useProjectStore.setEstimatedEndDate(projectId: string, date: string): Promise<void>` uses the API and updates both the project list and active detail, guarded by the existing session revision.
- Firestore Rules allow the account to update only this valid date field and reject foreign or mixed-field updates.

- [x] **Step 1: Write failing date-model tests** for a leap day, an impossible date, inclusive end date, following day, and a missing legacy value.
- [x] **Step 2: Run** `pnpm exec vitest run tests/projectEstimatedEndDate.test.ts`; confirm it fails because the model/helper is absent.
- [x] **Step 3: Implement** date validation and the inclusive/missing-date helper; add the optional project type and export.
- [x] **Step 4: Run** the focused date-model tests; expect all cases to pass.
- [x] **Step 5: Write failing Emulator tests** for owner update, foreign-user denial, invalid date denial, and denial when another project field changes in the same update.
- [x] **Step 6: Run** the focused Emulator test; confirm owner updates are denied before the rule/API changes.
- [x] **Step 7: Implement** the Firestore API and store method, then add the narrow date-only update rule.
- [x] **Step 8: Re-run** focused model, store, and Rules tests; expect all cases to pass.

### Task 2: Project editor and weekly calendar cutoff

**Files:**

- Create: `src/pages/project-detail/ProjectEstimatedEndDate.tsx`
- Modify: `src/pages/project-detail/ProjectDetailPage.tsx`, `src/pages/workforce/WeeklyProjectSchedule.tsx`, `tests/e2e/app.spec.ts`

**Interfaces:**

- The detail component receives `estimatedEndDate`, `disabled`, `loading`, and `onChange(date)`; changing the native date input saves through the store.
- Every day's project rows use `isOnOrBeforeEstimatedEndDate(dateKey, project.estimatedEndDate)` before applying the existing status and assignment logic.
- The calendar marks an unset estimate in the project card so the manager can distinguish a legacy/open-ended project.

- [x] **Step 1: Add an E2E assertion** that a project is visible on its saved estimated end date and absent on the next day, while its saved daily override remains in Firestore.
- [x] **Step 2: Run** the focused weekly-planner Playwright scenario through Auth/Firestore emulators. The first complete run exposed an invalid E2E fixture (its project lacked the persisted `id` required by Rules); the fixture was corrected to match production documents.
- [x] **Step 3: Implement** an accessible date editor in the project summary and connect it to `setEstimatedEndDate` with busy/error state.
- [x] **Step 4: Apply** the date helper to weekly rows and show a clear “Sin fecha estimada” marker when no estimate exists.
- [x] **Step 5: Re-run** the focused Playwright scenario; the inclusive cutoff, saved date, and retained override assertions pass.

### Task 3: Contract, verification, and release

**Files:**

- Modify: `docs/plan.md`, `docs/product.md`, `docs/architecture.md`, `docs/firebase.md`, `docs/state-and-cache.md`, `docs/styles-and-responsive.md`, and the BG-011 specification.

- [x] Document local-date storage, inclusive cutoff, missing-date compatibility, and unchanged project status/overrides.
- [x] Run focused model, Rules Emulator, and E2E checks; then `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check`, and `git diff --check`.
- [x] Record any unrelated existing failures accurately: the full unit suite has one pre-existing `catalogTradeImport.test.ts` expectation mismatch; all 61 Rules tests, focused date/store tests, and the weekly planner E2E pass.
- [x] Run `node scripts/check-deploy.mjs`, deploy `firestore:rules,hosting`, and compare the live HTML, relevant project/team bundles, and service workers with `dist`; verify `/projects`, `/team`, and a project-detail route return HTTP 200. Release `beb6f2e46178174d`; all 98 static files match `dist` and all three routes return 200.
- [x] Record that no production data was migrated or changed and the branch remains unmerged.

### Task 4: Keyboard-safe date confirmation (review correction)

**Files:**

- Modify: `src/pages/project-detail/ProjectEstimatedEndDate.tsx`, `src/pages/project-detail/ProjectDetailPage.tsx`, `tests/e2e/app.spec.ts`

- [x] **Step 1: Reproduce** year-segment editing in Chromium by typing `2027` into a date currently in 2026; assert that the stored value stays unchanged until the user confirms.
- [x] **Step 2: Observe RED:** the prior autosave persisted `0002-11-05` after the first key and disabled the date input.
- [x] **Step 3: Implement** an uncontrolled local draft and explicit “Guardar fecha” action so native segmented input cannot persist partial values.
- [x] **Step 4: Re-run** the weekly-planner E2E; confirm typing preserves the full year and saving persists `2027`.
- [ ] **Step 5: Include** this correction in the next Hosting release after the offline work; no Rules change is required.

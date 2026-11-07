# BG-011 Weekly Project Staffing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekly project staffing planner as the primary Equipo view, with day-specific editable assignments that never mutate a project's permanent roster.

**Architecture:** `/team` is the third primary navigation tab, after Budgets and Projects and before Requests. It shows the weekly planner directly, deriving each day from active projects' assignment snapshots until a manager edits that project/day. Persist edited snapshots under the project by local date. A circular edit action opens `/team/manage`, a secondary route for roster management that preserves the mounted planner. A Monday-to-Sunday view shows all days on desktop and one selected day on mobile, with swipe and buttons to change weeks.

**Tech Stack:** React, TypeScript, Zustand, Firebase Firestore, Firestore Rules, Vitest, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-06-bg011-planificacion-semanal-design.md`

## Global Constraints

- Keep the existing project-level `assignments` as the default source; a day-specific override must not modify them.
- Store local `YYYY-MM-DD` dates under `users/{uid}/projects/{projectId}/dailyAssignments/{date}`.
- Only projects with status `pending` or `in_progress` receive new/updated plans; saved plans on completed projects remain readable.
- Keep month view, time slots, notifications, and chapter completion milestones out of scope.
- Do not commit or merge: this worktree contains earlier BG-011 changes and the user authorized deployment, not branch integration.

## Review Focus

- Local date and Monday boundary around Sunday/Monday and year transitions; assert week keys in Task 1.
- Empty saved roster must override the project default; assert in Task 1.
- A crew's member can be excluded on one day without editing the permanent roster; assert in Task 1 and E2E.
- Same member in multiple project teams on one day must produce a visible conflict warning without blocking save; assert in Task 1 and E2E.
- Other accounts, missing projects, completed projects, mismatched date keys, and malformed schedule documents must be denied; assert in Task 2 against Firestore Rules Emulator.

---

### Task 1: Weekly date and staffing derivation

**Files:**

- Create: `src/entities/project/model/dailyAssignments.ts`
- Modify: `src/entities/project/model/types.ts`, `src/entities/project/index.ts`
- Test: `tests/projectDailyAssignments.test.ts`

**Interfaces:**

- Produces `ProjectDailyAssignmentOverride` with `date`, `projectId`, `assignments: ProjectAssignment[]`, and `updatedAt`.
- Produces `getWeekDateKeys(anchorDate: Date): string[]`, Monday through Sunday in local time.
- Produces `getEffectiveDayAssignments(defaults, override?)`, where an explicit empty override returns an empty list.
- Produces `findDailyAssignmentConflicts(projects)`, which reports a person assigned to multiple project cards on one date, including members embedded in crew snapshots.

- [x] Write tests for week boundaries/year changes, default-vs-empty override, crew member conflicts, and non-conflicts.
- [x] Run `pnpm exec vitest run tests/projectDailyAssignments.test.ts`; verify the missing module/functions fail as expected.
- [x] Implement the types and pure helpers with local date construction (no UTC date shifting).
- [x] Re-run the focused test; expect all cases to pass.

### Task 2: Firestore persistence and rules

**Files:**

- Modify: `src/entities/project/api/firestore.ts`, `src/entities/project/model/store.ts`, `src/entities/project/model/types.ts`, `src/entities/project/index.ts`, `firestore.rules`
- Test: `tests/projectDailyAssignments.rules.test.ts`, `tests/projectStore.test.ts`

**Interfaces:**

- `loadTeamSchedule(uid, projectIds, dateKeys)` returns global assignment snapshots plus date overrides for the requested project IDs and local week keys.
- `saveDailyAssignments(uid, projectId, dateKey, assignments)` writes one full date-specific snapshot.
- `removeDailyAssignmentOverride(uid, projectId, dateKey)` restores project-level defaults for that date.
- A saved override is stored at `users/{uid}/projects/{projectId}/dailyAssignments/{dateKey}` with matching `date`, `projectId`, `assignments`, and `updatedAt` fields.

- [x] Add Emulator tests for owner read/write/delete, other-user denial, missing/completed project denial, mismatched dates, unknown fields, and invalid assignment lists.
- [x] Run `pnpm exec vitest run tests/projectDailyAssignments.rules.test.ts`; confirm failures are caused by the absent rules/API.
- [x] Add bounded Firestore API operations and store wrappers; preserve session guards.
- [x] Add narrowly scoped rules for reading saved plans and writing only to owned pending/in-progress projects.
- [x] Re-run the focused rule/API test; expect all security and persistence cases to pass.

### Task 3: Weekly planner and roster management

**Files:**

- Create: `src/pages/workforce/WeeklyProjectSchedule.tsx`, `src/pages/workforce/DailyProjectAssignmentsDialog.tsx`
- Modify: `src/pages/workforce/WorkforcePage.tsx`, `src/app/AppShell.tsx`, `src/shared/ui/PageHeader.tsx`, `src/shared/ui/page-view-transition.ts`, `src/index.css`, `tests/e2e/app.spec.ts`

**Interfaces:**

- `WeeklyProjectSchedule` receives the current week, projects, project assignment snapshots, date overrides, and roster; it emits previous/next/current week navigation and date-specific save/reset actions.
- The global navigation order is Presupuestos, Proyectos, Equipo, Solicitudes; `/team` is a primary tab that shows the weekly planner directly, and `/team/manage` is the secondary CRUD route for the roster.
- The editor can add active roster resources, remove a whole crew/person, or remove an individual member from a crew for one date. The saved full snapshot affects only that project/date.

- [x] Add E2E coverage for default tab, week dates, default project roster, date-local crew/member removal, conflict warning, reset-to-default, and week navigation/swipe.
- [x] Run the focused Playwright scenario; verify it fails because the planner tab does not exist.
- [x] Build the accessible desktop seven-day board and mobile date strip/selected-day view; implement buttons and horizontal swipe between weeks.
- [x] Add the daily assignment editor, save/reset state, loading/error/empty states, and conflict indicator.
- [x] Re-run the focused E2E scenarios; expect the planner, override, and navigation assertions to pass.
- [x] Move `/team` to the third global tab, preserve Solicitudes as fourth, and render Equipo as a primary route.
- [x] Adapt the four-column mobile tab bar and primary-page header; remove the secondary-page back action from Equipo.
- [x] Verify tab order, active state, secondary-page returns, roster management, and planner behavior in focused E2E scenarios.

### Task 4: Documentation, verification, and deployment

**Files:**

- Modify: `docs/plan.md`, `docs/firebase.md`, `docs/state-and-cache.md`, `docs/styles-and-responsive.md`

- [x] Document the weekly planner separately from removed chapter milestones and record date-override persistence/rules.
- [x] Run focused unit, Firestore Rules Emulator, and E2E tests; then `pnpm lint`, `pnpm format:check`, Prettier on changed docs, and `git diff --check`.
- [x] Run `node scripts/check-deploy.mjs` and deploy `firestore:rules,hosting` with `node scripts/deploy.mjs firestore:rules,hosting`.
- [x] Verify live routes and compare the deployed HTML, service workers, and precached assets byte-for-byte with `dist`.

Full `pnpm test` ran 159 tests: 158 passed and one unrelated existing assertion fails in `tests/catalogTradeImport.test.ts` because the catalog now contains additional trade catalogs. Focused BG-011 coverage passes.

### Follow-up: weekly resource filter

- [x] Add a multiselect for members and crews; combine selections with OR semantics and keep a crew card while narrowing its displayed members for member-only filters.
- [x] Cover empty, member, crew, and combined filters in unit/E2E tests; update the product and responsive UI contracts.
- [x] Run focused checks and publish Hosting only; verify the live static bundle against `dist`.

### Follow-up: simplify Equipo and animate weeks

- [x] Remove internal tabs; add a circular management action and `/team/manage` secondary page that returns to the week without resetting it.
- [x] Add directional slide transitions for swipe/buttons and keep week controls on one line down to 320 px.
- [x] Cover the route, no-tabs state, responsive selector, transitions, and retained planner state in E2E; update UI contracts/evidence.
- [x] Run focused checks and publish Hosting only; verify the live static bundle against `dist`.

Follow-up verification (2026-11-06): the roster and weekly-planner E2E scenarios passed 2/2; focused unit tests passed 26/26 and Firestore Rules Emulator tests passed 58/58. `pnpm lint`, `pnpm format:check`, `pnpm build`, changed-doc Prettier, `git diff --check`, and deploy preflight passed. Published Hosting only to `budgenerator`, PWA `27ff86ef24070535`; all 98 static files match `dist` byte-for-byte and `/team`, `/team/manage`, `/projects`, `/projects/project-navigation`, and `/profile/solicitudes` return HTTP 200. Evidence is in `docs/testing-evidence/bg011-weekly-team-{desktop,mobile}.png` and `docs/testing-evidence/bg011-team-{desktop,mobile}.png`. No Rules, Functions, or production data changed; the worktree remains uncommitted and unmerged in `codex/bg011-equipo-agenda`.

### Follow-up: project card actions

- [x] Give the daily team-edit action a visible circular control and add a circular arrow to the project detail.
- [x] Keep the project title at full card width above the action row; cover both controls, their circular shape, title room, and project navigation in E2E.
- [x] Refresh desktop/mobile schedule evidence, run checks, and publish Hosting only.

Card action verification (2026-11-06): focused weekly-planner E2E passed 1/1, including accessible names, circle styles, title width, and navigation to `/projects/project-navigation`. `pnpm lint`, `pnpm format:check`, and `pnpm build` passed. Full `pnpm test` passed 159/160; the sole failure is the existing unrelated outdated catalog assertion in `tests/catalogTradeImport.test.ts`. Published Hosting only to `budgenerator`, PWA `e54c59a99c2e7ea7`; all 99 static files match `dist` byte-for-byte and `/team`, `/team/manage`, `/projects`, and `/projects/project-navigation` return HTTP 200. Updated screenshots: `docs/testing-evidence/bg011-weekly-team-desktop.png` and `bg011-weekly-team-mobile.png`. No Rules, Functions, or production data changed; worktree remains uncommitted and unmerged.

### Follow-up: real week swiper

- [x] Force the team action into an exact circle and use an in-app right arrow for project navigation.
- [x] Track horizontal pointer movement with an adjacent week preview; settle to the next/previous week or snap back, while preserving vertical scrolling and reduced-motion behavior.
- [x] Verify focused E2E, lint, formatting, build, refreshed evidence, and Hosting deployment.

Swiper verification (2026-11-06): focused weekly planner E2E passed 1/1, checking a circular 32 × 32 px people action, the right-arrow project action, live drag movement with the adjacent week visible, and snap/settle behavior. `pnpm lint`, `pnpm format:check`, `pnpm build`, changed-doc Prettier, `git diff --check`, and deploy preflight passed. Full `pnpm test` passed 159/160; the sole failure is the existing unrelated stale catalog expectation in `tests/catalogTradeImport.test.ts`. Published Hosting only to `budgenerator`, PWA `3cb4bdec4f582376`; all 98 static files match `dist` byte-for-byte and `/team`, `/team/manage`, `/projects`, and `/projects/project-navigation` return HTTP 200. Updated desktop/mobile captures: `docs/testing-evidence/bg011-weekly-team-desktop.png` and `bg011-weekly-team-mobile.png`. No Rules, Functions, or production data changed; worktree remains uncommitted and unmerged.

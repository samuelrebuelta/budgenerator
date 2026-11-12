# Trabajos independientes en planificación semanal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permitir registrar trabajos puntuales por día con equipo asignado, haya o no un proyecto enlazado, incluso después de completar una obra.

**Architecture:** Añadir trabajos como documentos independientes de la cuenta en Firestore, con fecha local y snapshots de equipo. La página `/team` abre una pantalla secundaria para crear el registro y luego lo muestra junto con los proyectos en la semana; el vínculo opcional sólo referencia al proyecto y no muta sus datos.

**Tech Stack:** React, TypeScript strict, React Router, Zustand, Firebase Firestore, Firestore Rules, Vitest, Firebase Rules Emulator y Playwright.

**Spec:** `docs/specs/2026-11-07-bg011-trabajos-sin-proyecto-design.md`

## Global Constraints

- Usar la instancia Firestore Standard ya configurada; no crear bases, índices compuestos, Functions ni dependencias nuevas.
- Mantener TypeScript strict, arquitectura `app → pages → features → entities → shared`, reglas de propietario y API pública de stores.
- Fechas de agenda `YYYY-MM-DD` en fecha local; no convertir día de trabajo a UTC.
- Persistir cada snapshot de recurso activo en `users/{uid}/teamJobs/{jobId}/assignments/{assignmentId}`; no escribir asignaciones de un trabajo bajo `projects/{projectId}`.
- Un proyecto completado se puede enlazar sin límite temporal; crear un trabajo nunca reabre ni modifica el proyecto, su presupuesto o progreso.
- Todos los trabajos requieren título y permiten omitir la descripción; los trabajos con proyecto muestran por defecto el título del proyecto como referencia.
- Escrituras sin conexión siguen el toast actual y no deben aparentar éxito.
- Interfaz y documentación en español; no editar datos reales ni desplegar sin instrucción explícita para esta entrega.

## Review Focus

- Una fecha local válida debe mantenerse en el día elegido al navegar, recargar o guardar; probar borde de mes/año y fecha inexistente.
- Un proyecto completado debe poder enlazarse, y su estado, progreso, fecha estimada, capítulos y presupuesto deben permanecer byte a byte iguales; cubrir en E2E.
- Una referencia de persona/cuadrilla inexistente o inactiva no debe persistirse; cubrir API y Rules Emulator.
- No permitir que la misma persona se asigne por separado y a través de una cuadrilla dentro del mismo trabajo; cubrir la selección del formulario.
- El CTA debe seguir disponible si no hay proyectos activos; el filtro semanal debe incluir sólo recursos coincidentes y el estado offline no debe crear una fila ficticia.
- Otro UID no debe leer ni crear registros bajo la cuenta; cubrir en Rules Emulator.

---

### Task 1: Modelo y validación de trabajos

**Files:**

- Modify: `src/entities/workforce/model/types.ts`
- Create: `src/entities/workforce/model/teamJobs.ts`
- Modify: `src/entities/workforce/index.ts`
- Test: `tests/teamJobs.test.ts`

**Interfaces:**

- `TeamJob`: `id`, `title`, `description`, `date`, `assignments`, optional `projectId`/`projectTitle`, `createdAt`, `updatedAt`.
- `validateTeamJobDraft(input)`: validates local date, title, description, at least one assignment, optional project fields, and the 900 KB document limit.
- `buildTeamJobAssignment(resource, members, assignedAt)`: creates the same immutable member/crew snapshot fields used by project day planning.
- `filterTeamJobsByResources(jobs, selectedResources)`: retains a job if its snapshots match a selected member or crew, including filtering a crew snapshot to selected member names.

- [x] **Step 1: Write failing model tests** for valid standalone jobs, required standalone title/description, project-linked jobs with optional description, malformed/nonexistent dates, duplicate crew/member assignment, inactive resources and selected-member filtering.
- [x] **Step 2: Run `pnpm exec vitest run tests/teamJobs.test.ts`** and confirm the new exports fail or are missing.
- [x] **Step 3: Implement the type and pure helpers** in `entities/workforce`; preserve snapshots and use local-date parsing only.
- [x] **Step 4: Run the focused test** and require every new model case to pass.

### Task 2: Firestore API and owner rules

**Files:**

- Modify: `src/entities/workforce/api/firestore.ts`
- Modify: `firestore.rules`
- Create: `tests/teamJobs.rules.test.ts`

**Interfaces:**

- `fetchTeamJobs(uid, startDate, endDate): Promise<TeamJob[]>` queries the owner's documents by inclusive local date range.
- `createTeamJob(uid, job): Promise<TeamJob>` validates the record and linked project, then writes only `users/{uid}/teamJobs/{jobId}`.
- `users/{uid}/teamJobs/{jobId}` holds metadata only. `assignments/{assignmentId}` is a separate immutable snapshot document created atomically with its parent.
- `users/{uid}/teamJobs/{jobId}` and its snapshots are owner-readable; the parent is owner-creatable and each snapshot creation validates one resource. Unrequested updates/deletes remain denied.

- [x] **Step 1: Write failing Rules Emulator cases** for an atomic owner transaction creating the parent and a valid member/crew snapshot, unlinked title+description, optional linked description, link to an owned completed project, cross-user denial, foreign-project denial, missing standalone description, invalid date, invalid/inactive assignment, and oversized fields.
- [x] **Step 2: Run `pnpm exec firebase emulators:exec --project demo-cimbra --only firestore "pnpm exec vitest run --config vitest.rules.config.ts tests/teamJobs.rules.test.ts"`** and confirm the valid record is denied because no team-job rule exists.
- [x] **Step 3: Implement API validation and narrow rules.** A project link must resolve only inside the owner's `projects`; completed status is allowed. One transaction creates the parent and one snapshot document per resource; each snapshot rule validates its own active source.
- [x] **Step 4: Rerun the Rules Emulator cases** and require valid linked/unlinked records to pass while foreign and malformed records fail.

### Task 3: Store, week reads and offline cache

**Files:**

- Modify: `src/entities/workforce/model/store.ts`
- Modify: `src/pages/workforce/WorkforcePage.tsx`
- Test: `tests/workforceStore.test.ts`

**Interfaces:**

- Store action `loadTeamJobs(uid, startDate, endDate, force?)` returns the date-bounded jobs and uses `memoryResourceCache` with a UID-scoped week key.
- Store action `createTeamJob(job)` performs the online-guarded mutation, then updates the current week cache and local store after Firestore confirms.

- [x] **Step 1: Add failing store tests** for week cache reuse, current-session protection, create result updating cached schedule, and avoiding state mutation after a denied write.
- [x] **Step 2: Run `pnpm exec vitest run tests/workforceStore.test.ts`** and confirm the job store behavior is absent.
- [x] **Step 3: Implement cache-aware reads and create action** with UID/session revision checks, `loadMemoryResource` and `guardNetworkMutation`; persist the job snapshot through the existing offline store registration.
- [x] **Step 4: Rerun workforce store tests** and require cache and no-network cases to pass.

### Task 4: New-work screen and navigation

**Files:**

- Create: `src/pages/workforce/NewTeamJobForm.tsx`
- Modify: `src/pages/workforce/WorkforcePage.tsx`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**

- `WeeklyProjectSchedule` invokes `onNewJob(dateKey)` for the selected day.
- `/team/jobs/new?date=YYYY-MM-DD` renders the secondary “Nuevo trabajo” page with date prefilled; `/team?date=YYYY-MM-DD` restores the week/day after cancel or save.
- `NewTeamJobForm` consumes active members, active crews, all projects including completed, and `onSubmit(draft)`.

- [x] **Step 1: Add a failing E2E** that opens the new-work page from a day, confirms the date, and sees active people/crews and completed projects in the selector.
- [x] **Step 2: Run the focused Playwright case** against Auth/Firestore emulators and confirm the “Nuevo trabajo” action/screen is absent.
- [x] **Step 3: Implement day CTA routing and form.** Require at least one resource and a title; keep description optional with or without a linked project. For a linked project initialize the title to its name. Save creates one independent record.
- [x] **Step 4: Extend the E2E** to create an unlinked job and a job linked to a completed project, navigate back to the requested day, and compare the completed project/budget/progress before and after.
- [x] **Step 5: Rerun the focused E2E** and require both records to be created and the source project unchanged.

### Task 5: Weekly agenda rendering and filters

**Files:**

- Modify: `src/pages/workforce/WeeklyProjectSchedule.tsx`
- Modify: `src/entities/project/model/dailyAssignments.ts`
- Test: `tests/projectDailyAssignments.test.ts`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**

- `WeeklyProjectSchedule` consumes the selected week of `TeamJob[]` and shows projects and standalone job cards on the same date.
- Daily indicators count both project cards and job records; resource filters apply to both.
- Conflict detection accepts both project cards and standalone jobs and reports repeated people across any two schedule cards.

- [x] **Step 1: Write failing unit tests** for jobs in empty project weeks, project/job conflicts, duplicate people within one card, and filtering jobs by a member or crew.
- [x] **Step 2: Run focused model tests** and confirm jobs are not represented in the project-only schedule.
- [x] **Step 3: Implement card rendering and day counts.** Keep the “Nuevo trabajo” action visible for every date, even when the week has no projects or filters hide project assignments. A linked job's navigation opens the project without editing it.
- [x] **Step 4: Extend E2E** to assert that both standalone and completed-project-linked jobs appear on their selected days, filter correctly, and are visible with no active projects.
- [x] **Step 5: Run focused unit and E2E cases** and require the full flow to pass.

### Task 6: Contracts and final verification

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/firebase.md`
- Modify: `docs/state-and-cache.md`
- Modify: `docs/styles-and-responsive.md`
- Modify: `docs/plan.md`

- [x] **Step 1: Document** the new `teamJobs` schema, owner rules, completed-project link behavior, local cache, offline failure, new-work route and weekly rendering.
- [x] **Step 2: Run focused checks** for `tests/teamJobs.test.ts`, `tests/teamJobs.rules.test.ts`, `tests/workforceStore.test.ts`, project weekly model tests and the new E2E case.
- [x] **Step 3: Run `pnpm exec firebase emulators:exec --project demo-cimbra --only firestore "pnpm exec vitest run --config vitest.rules.config.ts"`** to validate all rules against the emulator.
- [x] **Step 4: Run `pnpm lint`, `pnpm format:check`, `pnpm build`, and `git diff --check`;** run `pnpm test` and record known unrelated failures without folding them into this change.
- [x] **Step 5: Update `docs/plan.md`** with actual checks and any remaining risks. Do not deploy or merge without a specific instruction for this delivery.

## Resultados

- `pnpm exec tsc -b --pretty false`: correcto.
- `pnpm exec vitest run tests/projectDailyAssignments.test.ts tests/teamJobs.test.ts tests/workforceStore.test.ts`: 22/22.
- `pnpm test:rules` en Auth/Firestore/Functions Emulator: 73/73.
- E2E focalizada del nuevo trabajo independiente y el vínculo a un proyecto completado: 1/1, incluyendo el filtro semanal y la comprobación de que el proyecto no cambia.
- `pnpm lint`, `pnpm format:check`, `pnpm build` y `git diff --check`: correctos.
- `pnpm test`: 218/219; único fallo ajeno en `tests/catalogTradeImport.test.ts`, que espera una única biblioteca.
- Despliegue autorizado por el usuario a Hosting y Firestore Rules de `budgenerator`: PWA `013c3888cb3b5933`; 100 archivos comparados sin diferencias, `/`, `/team`, `/team/manage`, `/team/jobs/new?date=2026-11-07` y `/projects` respondieron HTTP 200. No se desplegaron Functions ni se escribieron documentos reales.

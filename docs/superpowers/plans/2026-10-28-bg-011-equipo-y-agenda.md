# BG-011 — Equipo de obra y agenda de hitos: Implementation Plan

> Alcance histórico. El 05-11-2026 el usuario pidió retirar la agenda y conservar sólo la gestión de equipo. La implementación vigente se define en `docs/superpowers/plans/2026-11-05-bg-011-retirar-agenda.md`; las tareas 5 y 6 de abajo quedan supersedidas.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Permitir registrar personas y cuadrillas, asignarlas a proyectos y consultar en una agenda los hitos de capítulos completados.

**Architecture:** Añadir una entidad `workforce` con documentos privados por cuenta y su store de sesión. Guardar asignaciones como snapshots en subcolecciones del proyecto; al completar un capítulo, escribir avance y evento de agenda en la misma transacción Firestore. Añadir `/team` y `/agenda` como rutas secundarias accesibles desde la experiencia de Proyectos y el menú de cuenta.

**Tech Stack:** React, TypeScript strict, Zustand, React Router, Firebase Firestore, Vitest, Playwright y Firebase Emulator; sin nuevas dependencias.

**Spec:** `docs/superpowers/specs/2026-10-28-bg-011-equipo-y-agenda-design.md`

## Global Constraints

- El propietario gestiona el equipo; no se crean cuentas ni permisos de trabajador.
- Las asignaciones son por proyecto, no por capítulo, y guardan etiqueta/color/composición como snapshot.
- Las cuadrillas con al menos una persona activa se pueden asignar; el snapshot incluye sólo integrantes activos.
- Los hitos se crean sólo en transiciones nuevas a capítulo completado; reabrir no borra el evento y completar otra vez crea otro.
- Las fechas se guardan como día local `YYYY-MM-DD`; la agenda consulta sólo el mes o la semana visibles, de forma privada y paginada.
- No se importan hitos anteriores a BG-011 ni se programan eventos futuros.
- Mantener FSD, revisión de sesión, idioma español, accesibilidad y comportamiento responsive existentes.
- Sin dependencias nuevas, migraciones de datos remotos, pruebas con datos de producción, auto-merge ni despliegue.

## Review Focus

- **Datos vacíos o malformados:** nombres/etiquetas vacíos, color desconocido, IDs de miembro repetidos o cuadrilla sin personas activas deben rechazarse con error localizado. Añadir tests en Task 1.
- **Cuadrilla con miembros inactivos:** si todos pasan a inactivos, la cuadrilla permanece visible pero no se ofrece para asignar hasta que recupere al menos una persona activa. Añadir tests en Tasks 3/4.
- **Reintentos y reapertura:** un reintento no duplica el evento; reabrir lo conserva y completar de nuevo crea un evento nuevo. Añadir tests en Task 5.
- **Corrección de fecha:** actualizar un capítulo cambia el hito de su última finalización y conserva el día local. Añadir tests en Task 5.
- **Cambio de periodo:** cambiar entre mes/semana o usar swipe/botones reinicia rango/cursor sin mezclar hitos de periodos anteriores. Añadir tests de store/API y E2E en Tasks 5/6.
- **Aislamiento y sesión:** otra cuenta no puede leer/escribir equipo, asignaciones ni agenda; respuestas de sesión anterior se descartan. Añadir pruebas de reglas en Tasks 2/4/5 y de store en Tasks 3/5.

---

### Task 1: Contratos y validaciones puras del equipo

**Files:**

- Create: `src/shared/types/workforce.ts`
- Modify: `src/shared/types/index.ts`
- Create: `src/entities/workforce/model/types.ts`
- Create: `src/entities/workforce/model/validation.ts`
- Create: `tests/workforceModel.test.ts`

**Interfaces:**

- `WorkforceMember`: `{ id: string; name: string; status: 'active' | 'inactive'; createdAt: string; updatedAt: string }`.
- `WorkCrew`: `{ id: string; label: string; color: CrewColor; memberIds: string[]; status: 'active' | 'inactive'; createdAt: string; updatedAt: string }`.
- `CrewColor` is declared in `src/shared/types/workforce.ts` as `'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'cyan' | 'slate'` so `project` and `workforce` can share it without importing one entity from another.
- `CrewInput`: `{ label: string; color: string; memberIds: string[] }`; `ValidatedCrewInput`: `{ label: string; color: CrewColor; memberIds: string[] }`.
- `normalizeWorkforceName(value: string): string` trims and collapses whitespace.
- `validateMemberName(value: string): string` returns the normalized name or throws a Spanish `Error` for empty input or input over 100 characters.
- `validateCrewInput(input: CrewInput, members: WorkforceMember[]): ValidatedCrewInput` validates a non-empty label (max 60 characters), known color, unique existing member IDs and a non-empty member list. Creation requires at least one active member; a saved crew may later have no active members.

- [x] **Step 1: Write pure validation tests** for trimmed names, blank/oversized names and labels, invalid colors, duplicate IDs, unknown IDs and empty member lists.
- [x] **Step 2: Run `pnpm test -- tests/workforceModel.test.ts`** and confirm it fails because the model does not exist.
- [x] **Step 3: Implement the contracts and validators** in the two model files with the exact types above.
- [x] **Step 4: Run `pnpm exec vitest run --config vitest.config.ts tests/workforceModel.test.ts`** and confirm all validation cases pass.

### Task 2: Persistencia y reglas del roster

**Files:**

- Create: `src/entities/workforce/api/firestore.ts`
- Modify: `firestore.rules`
- Test: `tests/workforce.rules.test.ts`

**Interfaces:**

- `createWorkforceFirestoreApi(database)` exposes `fetchMembers(uid)`, `fetchCrews(uid)`, `saveMember(uid, member)`, `saveCrew(uid, crew)`, `setMemberStatus(uid, memberId, status)` and `setCrewStatus(uid, crewId, status)`.
- Persist members at `users/{uid}/teamMembers/{memberId}` and crews at `users/{uid}/crews/{crewId}`.
- `saveCrew` validates existing member references and enforces a document size below 900,000 UTF-8 bytes. Creating a crew requires at least one active member; later member deactivation may leave it with none. Crew/member names and status remain owner-private.

- [x] **Step 1: Add emulator/API tests** for owner CRUD, cross-account denial, malformed documents, invalid color/status, a crew referencing a missing member, and creating a crew without an active member.
- [x] **Step 2: Run the focused rules tests against Firestore Emulator** and confirm a valid owner write fails before rules/API changes.
- [x] **Step 3: Implement the Firestore adapter and rules** for the two owner-scoped collections; do not expand access in the generic user collection matcher.
- [x] **Step 4: Run the focused rules test in Firestore Emulator** with `pnpm exec firebase emulators:exec --project demo-bg011-workforce --only firestore "pnpm exec vitest run --config vitest.rules.config.ts tests/workforce.rules.test.ts"` and confirm owner isolation and document validation pass.

### Task 3: Store y gestión de personas/cuadrillas

**Files:**

- Create: `src/entities/workforce/model/store.ts`
- Create: `src/entities/workforce/index.ts`
- Create: `src/pages/workforce/WorkforcePage.tsx`
- Create: `src/pages/workforce/index.ts`
- Modify: `src/app/session.ts`
- Modify: `src/app/router.tsx`
- Modify: `src/app/AppShell.tsx`
- Test: `tests/workforceStore.test.ts`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**

- Store exposes `members`, `crews`, `loaded`, `loadWorkforce(uid)`, `saveMember(member)`, `saveCrew(crew)`, `setMemberStatus(id, status)` and `setCrewStatus(id, status)`.
- Session reset clears workforce state; `/team` and project assignment UI load roster data on demand. Reads/writes apply local state only when the captured session revision remains current.
- `/team` is a secondary route linked from the account menu and can be reached from Projects. No new primary navigation tab is added.

- [x] **Step 1: Add store tests** for member/crew edits, activation changes, duplicate prevention and stale-session responses.
- [x] **Step 2: Run `pnpm test -- tests/workforceStore.test.ts`** and confirm the missing-store failure.
- [x] **Step 3: Implement the session-aware store** using the Task 2 API and existing `sessionRevision` helpers; reset it from `src/app/session.ts` but do not add workforce reads to the global login load.
- [x] **Step 4: Add `/team` management UI** using existing forms, modals, buttons and responsive page shell; show color and label together so color is never the sole identifier.
- [x] **Step 5: Add an E2E flow** that creates and edits a person, creates a colored crew, deactivates/reactivates a member and verifies inactive resources are not selectable for new assignments.
- [x] **Step 6: Run the focused store and E2E tests** and verify keyboard operation and mobile layout.

### Task 4: Asignaciones snapshot en proyectos

**Files:**

- Modify: `src/entities/project/model/types.ts`
- Modify: `src/entities/project/api/firestore.ts`
- Modify: `src/entities/project/model/store.ts`
- Modify: `firestore.rules`
- Create: `src/pages/project-detail/ProjectTeamAssignments.tsx`
- Modify: `src/pages/project-detail/ProjectDetailPage.tsx`
- Test: `tests/projectAssignments.test.ts`
- Test: `tests/projectAssignments.rules.test.ts`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**

- `ProjectAssignment`: `{ id: string; resourceType: 'member' | 'crew'; resourceId: string; label: string; color?: CrewColor; members: { id: string; name: string }[]; assignedAt: string }`.
- Add `assignments: ProjectAssignment[]` to `ProjectDetail` (not to the budget snapshot or economic project summary).
- Project store exposes `addAssignment(projectId, resourceType, resourceId)` and `removeAssignment(projectId, assignmentId)`.
- Persist at `users/{uid}/projects/{projectId}/assignments/{assignmentId}` with deterministic IDs `member_{resourceId}` or `crew_{resourceId}`.
- Assigning a member snapshots that member; assigning a crew snapshots its label, color and active members only. Reject a crew with no active members. Later roster edits do not alter existing snapshots.

- [x] **Step 1: Add pure assignment tests** for member snapshots, active crew member filtering, empty-active-crew rejection, 900,000-byte size rejection and stable IDs.
- [x] **Step 2: Add rules emulator tests** for owner project access and cross-user/project denial; verify assignment IDs and allowed fields.
- [x] **Step 3: Run the focused tests** and confirm the missing assignment API/rules failures.
- [x] **Step 4: Implement assignment persistence and store updates** without changing progress, totals or the accepted-budget snapshot.
- [x] **Step 5: Add the project detail assignment panel** with add/remove controls using active workforce records and saved snapshots.
- [x] **Step 6: Add an E2E case** that assigns a person and crew, verifies names/color/composition, edits the source crew and confirms the saved project snapshot stays unchanged, then removes an assignment.
- [x] **Step 7: Run focused assignment, rules and E2E tests.**

### Task 5: Hitos transaccionales y API de agenda

**Files:**

- Modify: `src/entities/project/model/types.ts`
- Modify: `src/entities/project/api/firestore.ts`
- Modify: `src/entities/project/model/store.ts`
- Modify: `firestore.rules`
- Test: `tests/projectMilestone.rules.test.ts`
- Test: `tests/projectStore.test.ts`

**Interfaces:**

- `ProjectMilestone`: `{ id: string; projectId: string; projectTitle: string; clientName: string; workItemId: string; workItemName: string; completedAt: string; recordedAt: string }`.
- Add optional `latestMilestoneId` to `ProjectWorkItem`; rules allow it to change only in the transaction creating a matching milestone.
- `createProjectFirestoreApi(database)` exposes `fetchAgendaRange(uid, startDate, endDate, cursor?) -> { items: ProjectMilestone[]; nextCursor: { completedAt: string; id: string } | null }` with 50 entries per page where `completedAt >= startDate && completedAt < endDate`, ordered by `completedAt` descending then document ID descending.
- Project store adds `agenda`, `agendaCursor`, `agendaHasMore`, `agendaLoading` and `loadAgendaPeriod(startDate, endDate, reset?)`; it merges pages by event ID, resets when the visible range changes, and applies responses only to the current session revision and requested range.
- A real transition from incomplete to complete creates one immutable milestone at `users/{uid}/projectAgenda/{eventId}` in the same transaction as work-item and project-summary updates. Generate `eventId` before entering the transaction so retries reuse it.
- Reopening keeps prior milestones. Re-completing creates a new milestone and updates `latestMilestoneId`. Correcting the currently completed chapter date updates only the milestone referenced by that field.

- [x] **Step 1: Add pure transition/store tests** for completion, no-op retry, reopen retention, second completion and date correction.
- [x] **Step 2: Add emulator rules tests** for owner reads, denied cross-account access, denied standalone/forged event creation and valid atomic completion/date correction.
- [x] **Step 3: Run focused tests against Vitest and Firestore Emulator** and verify the expected pre-implementation failures.
- [x] **Step 4: Implement transaction writes** for the project summary, chapter and milestone, extending rules to validate the related state transition.
- [x] **Step 5: Implement `fetchAgendaRange`** with inclusive start/exclusive end, a stable cursor and no local persistence of private events.
- [x] **Step 6: Run focused tests** plus project progress/store regression tests.

### Task 6: Página Agenda y navegación

**Files:**

- Create: `src/pages/agenda/AgendaPage.tsx`
- Create: `src/pages/agenda/index.ts`
- Modify: `src/app/router.tsx`
- Modify: `src/pages/projects/ProjectsPage.tsx`
- Modify: `src/pages/project-detail/ProjectDetailPage.tsx`
- Test: `tests/e2e/app.spec.ts`

**Behavior:**

- `/agenda` is a secondary route with return to `/projects`; the Proyectos list links to it and the project detail can link to its project's milestones.
- Provide a `Mes | Semana` selector. Both modes show a vertical agenda grouped by day, following Uuma's agenda pattern; `Semana` covers Monday through Sunday, and `Mes` covers the natural calendar month.
- Mobile users can swipe horizontally to move one month/week at a time. Show accessible previous/next controls at every width; on desktop they are the primary period navigation. Include a visible `Hoy` control/marker. Respect `prefers-reduced-motion` and preserve vertical scrolling.
- Show project, client, chapter and local completion date. Query only the visible range, load 50 entries at a time and append older pages without duplicates; reset items/cursor on view or period change.
- Empty state explains that the agenda starts tracking new chapter completions after BG-011; existing completions are not backfilled.
- Preserve keyboard access, loading/error/retry patterns and the existing mobile shell; no new navigation tab.

- [x] **Step 1: Add E2E coverage** for team/project assignment, chapter completion, Mes/Semana switching, `Hoy`, mobile swipe and desktop previous/next controls; unit/store/rules tests cover range boundaries, Monday–Sunday weeks, pagination reset, sorting and date corrections.
- [x] **Step 2: Implement the page and links** using existing PageHeader, PageLink, list/card and loading components.
- [x] **Step 3: Run targeted E2E at 320, 390 and desktop widths** and review focus order and date labels.

### Task 7: Contratos y cierre

**Files:**

- Modify: `docs/plan.md`
- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/firebase.md`
- Modify: `docs/state-and-cache.md`
- Modify: `docs/superpowers/specs/2026-10-28-bg-011-equipo-y-agenda-design.md`

- [x] Record the implemented fields, routes, snapshot behavior, event rules and actual rollout/backfill decision in technical docs.
- [x] Run focused model/store checks and Firestore Emulator tests; run `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm build` and `pnpm format:check`, recording failures as well as passes.
- [x] Confirm rules tests ran against Firestore Emulator. No deployment or migration of existing user data was performed.

## Ejecución y verificación — 05-11-2026

- Tests focalizados de modelo/store: 31/31; tests focalizados de reglas Firestore: 26/26; integración completa de reglas: 55/55.
- E2E focalizados BG-011: gestión de equipo, asignaciones snapshot y agenda; pasan 3/3. La E2E del roster comprueba que personas inactivas y cuadrillas sin integrantes activos no son opciones de asignación.
- `pnpm test`: 155 correctos y 1 fallo ajeno en la expectativa de `tests/catalogTradeImport.test.ts`.
- `pnpm test:integration`: 39 E2E correctos y 4 fallos ajenos en el prompt push, dos flujos del catálogo y estructura guiada.
- `pnpm lint`, `pnpm build`, `pnpm format:check` y `git diff --check`: correctos. Node 24.14.0 frente a Node 22 declarado por Functions produce la advertencia de versión existente.
- Navegador integrado: ocho capturas desktop/mobile de Equipo, asignaciones de proyecto y agenda Mes/Semana en `docs/testing-evidence/`.
- Sin merge, despliegue, backfill ni cambios en datos reales.

## Plan self-review

- Spec coverage: every goal, flow, security rule and acceptance criterion maps to Tasks 1–7.
- Type consistency: `ProjectAssignment` and `ProjectMilestone` are introduced in project types; `latestMilestoneId` links only the current chapter completion to its event; workforce types remain a separate entity.
- Review focus: each of the five high-risk inputs/conditions has a named test in its owning task.
- Scope: roster, project assignments and completion agenda are one cohesive project-workflow change; no future scheduling or worker accounts are introduced.

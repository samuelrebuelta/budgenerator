# BG-011 — Retirar agenda y conservar gestión del equipo: Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Retirar la agenda y el registro de hitos de BG-011, conservando el roster y las asignaciones de personas/cuadrillas a proyectos.

**Architecture:** El progreso y las fechas de partidas/capítulos vuelven al contrato de BG-009, sin crear ni actualizar documentos de agenda. Se elimina `/agenda`, sus enlaces, tipos, API, estado, reglas y vistas; las asignaciones snapshot y `/team` permanecen.

**Tech Stack:** React, TypeScript strict, Zustand, React Router, Firebase Firestore, Vitest, Playwright y Firebase Emulator; sin dependencias nuevas.

**Scope decisions:**

- Mantener `teamMembers`, `crews` y asignaciones snapshot en proyectos, incluidos sus formularios y reglas.
- Dejar intactas las fechas editables de partidas/capítulos y el resumen de proyecto de BG-009.
- No escribir nuevos hitos ni conservar `latestMilestoneId` en work items.
- Quitar la ruta y los enlaces a Agenda. No hacer migraciones ni borrar datos remotos.
- Las pruebas usarán exclusivamente Firestore/Auth Emulator.

## Task 1: Especificar la ausencia de agenda en pruebas

**Files:**

- Replace: `tests/projectMilestone.rules.test.ts` with `tests/projectAgendaRemoval.rules.test.ts`.
- Modify: `tests/e2e/app.spec.ts`.

- [x] Añadir una prueba de reglas que complete un capítulo y afirme que se actualizan su progreso y `completedAt`, sin crear `projectAgenda` ni `latestMilestoneId`.
- [x] Añadir pruebas de que el propietario no puede leer ni escribir la colección retirada.
- [x] Reemplazar el E2E de agenda por uno que verifique que Proyectos y el detalle sólo ofrecen Equipo/Asignar equipo.
- [x] Ejecutar primero la prueba de reglas en rojo (2 fallos por escritura/acceso anterior) y después verificar en verde con Firestore Emulator.

## Task 2: Quitar superficie y estado de agenda

**Files:**

- Modify: `src/app/router.tsx`, `src/pages/projects/ProjectsPage.tsx`, `src/pages/project-detail/ProjectTeamAssignments.tsx`.
- Delete: `src/pages/agenda/`.
- Modify: `src/entities/project/model/types.ts`, `src/entities/project/model/store.ts`, `src/entities/project/api/firestore.ts`, `src/entities/project/index.ts`.
- Modify: `tests/projectStore.test.ts`.
- Delete: `tests/agendaCalendar.test.ts`.

- [x] Eliminar ruta, enlaces, interfaz, helpers de calendario, tipos, API y estado de paginación de agenda.
- [x] Eliminar creación de hitos al completar capítulos y la actualización de hitos al corregir fechas; mantener las transacciones de progreso, `completedAt` y el resumen BG-009.
- [x] Retirar pruebas de paginación/periodos de agenda y conservar las regresiones de progreso y asignaciones.
- [x] Ejecutar build/typecheck y pruebas focalizadas de proyecto.

## Task 3: Retirar reglas y cerrar contrato

**Files:**

- Modify: `firestore.rules`.
- Modify: `docs/plan.md`, `docs/product.md`, `docs/architecture.md`, `docs/firebase.md`, `docs/state-and-cache.md`, `docs/styles-and-responsive.md`, `docs/performance.md`.
- Modify: `docs/specs/2026-10-28-bg-011-equipo-y-agenda-design.md`.
- Remove obsolete BG-011 agenda/project screenshots from `docs/testing-evidence/`.

- [x] Eliminar validadores, vínculos y acceso a `projectAgenda`; permitir sólo la actualización de `tasks` en el camino normal de progreso.
- [x] Actualizar documentos vigentes para describir sólo roster, cuadrillas y asignaciones. Marcar la spec de agenda original como supersedida.
- [x] Ejecutar reglas Firestore Emulator, E2E focalizados, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check` y `git diff --check`.
- [x] Registrar los fallos ajenos. No hacer merge, despliegue, migración ni borrado de datos remotos.

## Verificación registrada (06-11-2026)

- Firestore Emulator: 53/53 reglas pasan. La prueba de reglas específica pasó 2/2.
- E2E focalizados de alta/edición de equipo, asignación snapshot y ausencia de enlaces de Agenda: 3/3 pasan.
- E2E global en integración: 39/43 pasan; cuatro fallos previos ajenos a BG-011: aviso push, dos persistencias/búsquedas de catálogo y guardado de estructura guiada.
- `pnpm test`: 151/152 pasan; el único fallo previo ajeno es la expectativa de catálogo en `tests/catalogTradeImport.test.ts`.
- `pnpm lint`, `pnpm build`, `pnpm format:check` y `git diff --check`: pasan. `build:functions` también pasa con el aviso de que el entorno usa Node 24 frente a Node 22 requerido.
- No se hizo merge, despliegue, migración ni escritura en producción.

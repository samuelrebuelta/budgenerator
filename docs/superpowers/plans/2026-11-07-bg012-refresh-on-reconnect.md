# BG-012 Refresh on Reconnection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh loaded session data and the active route's remote data when Firebase or the browser connection recovers.

**Architecture:** Track each offline-to-online transition in the network store. On recovery, flush queued writes before refreshing the session stores; then increment a data refresh version consumed by active route read effects. If session retry itself restores connectivity, reuse its successful store refresh and only trigger route reads.

**Tech Stack:** React, TypeScript, Zustand, Firebase, Vitest.

**Spec:** `docs/specs/BG-012-modo-offline.md`

## Global Constraints

- Keep cached content visible while reconnection refreshes run.
- Do not reload the page or show a blocking skeleton during refresh.
- Flush queued writes before reading fresh remote values.
- Do not add dependencies, change Rules or Functions, or write production test data.

## Review Focus

- Browser offline-to-online event: flush writes, refresh stores, then current route data.
- Firebase unavailable while `navigator.onLine` stays true: the successful retry refreshes session and active-route data.
- Firebase unavailable on an unauthenticated public route: the active public read is retried and refreshes the route without loading private session data.
- A queued write fails on reconnect: do not refresh over unsaved local state.
- An unauthenticated public route recovers: refresh its active route data without attempting a private session load.
- Account switch during refresh: existing session revision guards continue to reject stale responses.

---

### Task 1: Coordinate reconnect refresh and route revalidation

**Files:**

- Modify: `src/shared/model/network.ts`
- Create: `src/app/refreshOnReconnect.ts`
- Modify: `src/app/PwaStatus.tsx`, `src/app/session.ts`
- Modify: route read effects in `src/pages/admin/AdminPage.tsx`, `src/pages/budget-detail/BudgetDetailPage.tsx`, `src/pages/budget-viewer/BudgetViewerPage.tsx`, `src/pages/leads/LeadsPage.tsx`, `src/pages/project-detail/ProjectDetailPage.tsx`, `src/pages/public-quote/QuoteEstimatorPage.tsx`, `src/pages/quote-estimator/QuoteEstimatorSettingsPage.tsx`, `src/pages/workforce/WorkforcePage.tsx`, and `src/pages/project-detail/ProjectTeamAssignments.tsx`
- Modify: `src/entities/user/model/store.ts`
- Test: `tests/networkStatus.test.ts`, `tests/session.test.ts`, `tests/refreshOnReconnect.test.ts`
- Modify: `docs/specs/BG-012-modo-offline.md`, `docs/state-and-cache.md`, `docs/plan.md`

**Interfaces:**

- Network store exposes a recovery version/source and a data refresh version.
- `refreshAfterNetworkRecovery(user, sessionAlreadyRefreshed)` flushes queued writes, force-refreshes session stores when needed, then advances the data refresh version once for the recovered connection.
- Session-probe recovery reuses its already refreshed stores.
- Authenticated route readers reload when the data refresh version advances; admin user reads accept a force flag.

- [x] **Step 1: Write failing tests** for one refresh-version increment per recovery, session-vs-browser recovery source, queued-write ordering/guard, session recovery without duplicate store reload, public-route recovery without private reads, and draft preservation.
- [x] **Step 2: Run the tests and verify the failures** are caused by the missing reconnect refresh contract; the unsaved profile draft and public-route recovery tests failed before their guards/probe existed.
- [x] **Step 3: Implement the recovery coordinator and route effect subscriptions** while preserving the visible cache and avoiding refresh when writes remain pending. Profile drafts now persist their dirty flag in the offline snapshot and are preserved across refreshes.
- [x] **Step 4: Run focused tests, lint, format, build and `git diff --check`; run the existing offline reload E2E.** Focused tests 24/24, E2E 1/1, lint/build/format/diff check pass. Full unit suite 206/207; one unrelated stale catalog expectation remains.
- [x] **Step 5: Update the BG-012 contract and plan with verified behavior and deployment details.** Deployed to Firebase Hosting only as PWA `87b414491ff48bd9`; verified 99/99 files byte-identical and key routes HTTP 200.

## Execution Rulings

- Implement inline in the existing isolated worktree because the user directly requested this behavior and the change builds on the current BG-012 branch. The user's explicit “Despliega cuando esté” instruction for the ongoing offline-mode work authorizes publishing this cohesive follow-up to Firebase Hosting after verification; do not deploy Rules or Functions.

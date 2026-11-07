# BG-012 Offline Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the last data already loaded visible through offline navigation and reloads, and show an accessible toast when an offline mutation cannot be saved.

**Architecture:** Add a shared network-status store that reflects browser events and real Firebase network failures, plus a small accessible toast host. Persist data-only Zustand snapshots and route-only results in an application IndexedDB cache partitioned by UID; restore it before authenticated routes mount and clear the previous UID on sign-out/account change. Do not enable Firestore's global persistent cache. Existing `WriteQueue` retry behavior remains unchanged.

**Tech Stack:** React 19, TypeScript, Zustand, Firebase Web SDK, Vitest, Playwright.

**Spec:** `docs/specs/BG-012-modo-offline.md`

## Global Constraints

- Data already loaded by the app persists in IndexedDB; no new writes are accepted offline and no user data is added to `localStorage` or `sessionStorage`.
- Private snapshots use UID-scoped keys, are cleared when the account changes or signs out, and cannot be restored for a different UID. Public route data is keyed by its access token.
- A view with cached data keeps that data during offline navigation; a view without cached data shows an explicit offline message and no read skeleton or spinner.
- An offline mutation shows one accessible toast and is not represented as confirmed.
- Network/unavailable errors during reads and writes mark Firebase unavailable; when the browser remains connected, later requests and a periodic session retry can recover and flush queued writes.
- Existing `WriteQueue` retry behavior after reconnection remains the only write queue.
- Do not change Firestore Rules, Functions or production documents.

## Review Focus

- `navigator.onLine` remains `true` while Firebase reports `unavailable`: retain cached reads and toast failed mutations; cover with a network utility test and a page-level test.
- A new route has no cached result: render the offline message without skeletons; cover the shared fallback and one route test.
- A route was visited and then unmounted: its in-memory result remains available when revisited offline; cover memory cache lookup and a Playwright navigation flow.
- The authenticated UID changes: clear all private snapshots and prevent in-flight reads from restoring the old account's cache; cover cache generation invalidation.
- An already queued write is retried after reconnection: retain pending/error state and flush behavior without duplicating work; cover the existing queue path and offline E2E.

---

### Task 1: Network status and accessible offline toast

**Files:**

- Create: `src/shared/model/network.ts`
- Create: `src/shared/model/toast.ts`
- Create: `src/shared/ui/ToastHost.tsx`
- Modify: `src/shared/ui/index.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/PwaStatus.tsx`
- Test: `tests/networkStatus.test.ts`
- Test: `tests/offlineToast.test.ts`

**Interfaces:**

- Produces: `useNetworkStore`, `setNetworkOnline(online: boolean)`, `reportNetworkUnavailable(error: unknown)`, `isNetworkUnavailable(error: unknown)`, `showOfflineMutationToast()`, and `useToastStore`.
- Toast copy: `Sin conexión. No se ha podido guardar el cambio.`; render one `role="alert"` toast and coalesce repeated offline mutation notices for the same brief outage.

- [x] **Step 1: Write failing tests** for network state transitions, network error classification (`unavailable`, `functions/unavailable`, `network-request-failed`, and fetch `TypeError`), and one coalesced accessible offline toast.
- [x] **Step 2: Run the tests and verify they fail** because the network and toast modules do not exist.
- [x] **Step 3: Implement the network store and toast host**; seed the store from `navigator.onLine`, update it from `online`/`offline`, keep PWA status connected to the shared store, and mount the toast host once in `App`.
- [x] **Step 4: Run the focused tests** with `pnpm exec vitest run tests/networkStatus.test.ts tests/offlineToast.test.ts`; expect all tests to pass.

### Task 2: Guard remote mutations and preserve queue behavior

**Files:**

- Create: `src/shared/lib/networkMutation.ts`
- Modify: `src/shared/lib/writeQueue.ts`
- Modify: `src/entities/budget/api/firestore.ts`
- Modify: `src/entities/budget/api/acceptance.ts`
- Modify: `src/entities/catalog/api/firestore.ts`
- Modify: `src/entities/notifications/api/functions.ts`
- Modify: `src/entities/profile/api/firestore.ts`
- Modify: `src/entities/project/api/firestore.ts`
- Modify: `src/entities/quote-estimator/api/firestore.ts`
- Modify: `src/entities/template/api/firestore.ts`
- Modify: `src/entities/user/api/firestore.ts`
- Modify: `src/entities/workforce/api/firestore.ts`
- Test: `tests/networkMutation.test.ts`
- Test: `tests/writeQueue.test.ts`

**Interfaces:**

- Consumes: Task 1 network store and toast API.
- Produces: `runNetworkMutation<T>(operation: () => Promise<T>): Promise<T>`; it blocks before starting when offline, reports real network failures, and rethrows the original error for existing caller handling.
- `WriteQueue.schedule` keeps its existing in-memory retry semantics and reports an offline toast immediately when newly scheduled while disconnected.

- [x] **Step 1: Write failing tests** proving an offline mutation does not call its operation, a Firebase unavailable error sets offline state and shows a toast, and `WriteQueue` keeps a scheduled value pending and flushes it once when the connection returns.
- [x] **Step 2: Run the focused tests and verify the expected failures.**
- [x] **Step 3: Add the guard to Firestore and callable write entry points**; retain validation, existing caller errors and the current queue semantics.
- [x] **Step 4: Run the focused tests** with `pnpm exec vitest run tests/networkMutation.test.ts tests/writeQueue.test.ts`; expect all tests to pass.

### Task 3: Session-scoped memory cache and read failure handling

**Files:**

- Create: `src/shared/lib/memoryResourceCache.ts`
- Modify: `src/app/session.ts`
- Test: `tests/memoryResourceCache.test.ts`
- Test: `tests/session.test.ts`

**Interfaces:**

- Produces: `getMemoryResource<T>(key: string): T | undefined`, `setMemoryResource<T>(key: string, value: T): void`, and `clearMemoryResources(): void`.
- Private route cache keys include the UID; `resetSession` clears them on logout or account change.
- A network-only failure during initial session loading marks the app connection unavailable and allows `AppShell` to show cached stores or route-level offline fallbacks instead of an indefinite loading screen.

- [x] **Step 1: Write failing tests** for cached value lifecycle, cache clearing on session reset, and an initial network failure opening the authenticated shell in an offline state.
- [x] **Step 2: Run the focused tests and verify the expected failures.**
- [x] **Step 3: Implement the memory cache and session fallback**; never serialize private page data to browser storage.
- [x] **Step 4: Run the focused tests** with `pnpm exec vitest run tests/memoryResourceCache.test.ts tests/session.test.ts`; expect all tests to pass.

### Task 4: Cached reads, no-loader offline states, and route fallbacks

**Files:**

- Create: `src/shared/ui/OfflineUnavailable.tsx`
- Modify: `src/pages/admin/AdminPage.tsx`
- Modify: `src/app/AuthGuard.tsx`
- Modify: `src/pages/budget-detail/BudgetDetailPage.tsx`
- Modify: `src/pages/budget-viewer/BudgetViewerPage.tsx`
- Modify: `src/pages/leads/LeadsPage.tsx`
- Modify: `src/pages/project-detail/ProjectDetailPage.tsx`
- Modify: `src/pages/project-detail/ProjectTeamAssignments.tsx`
- Modify: `src/pages/public-quote/QuoteEstimatorPage.tsx`
- Modify: `src/pages/quote-estimator/QuoteEstimatorSettingsPage.tsx`
- Modify: `src/pages/workforce/WorkforcePage.tsx`
- Modify: `src/pages/budgets/BudgetsPage.tsx`
- Modify: `src/pages/catalogs/CatalogDetailPage.tsx`
- Modify: `src/pages/profile/ProfilePage.tsx`
- Modify: `src/pages/projects/ProjectsPage.tsx`
- Modify: `src/pages/template-detail/TemplateDetailPage.tsx`
- Modify: `src/pages/templates/TemplatesPage.tsx`
- Modify: `src/pages/workforce/WeeklyProjectSchedule.tsx`
- Modify: `src/entities/project/model/store.ts`
- Modify: `src/entities/user/model/store.ts`
- Test: `tests/offlineReads.test.ts`
- Test: offline regressions in `tests/e2e/app.spec.ts`

**Interfaces:**

- Consumes: Tasks 1 and 3 network/cache APIs.
- Produces: `OfflineUnavailable` with Spanish copy explaining that this view has not been loaded in the current session and needs a connection.
- Cache route-only reads by UID plus route key (public token for public routes); retain last successful value until session reset.
- Existing Zustand-loaded lists and project/workforce details render their last store/cache values. If no value exists and the network is unavailable, replace the read skeleton/loading state with `OfflineUnavailable`.

- [x] **Step 1: Write failing tests** for retaining a cached result after a rejected network read, showing the explicit no-cache fallback without any skeleton, and revisiting a cached route offline.
- [x] **Step 2: Run `pnpm exec vitest run tests/offlineReads.test.ts` and the focused offline E2E in `tests/e2e/app.spec.ts`; verify the intended failures.**
- [x] **Step 3: Add UID-scoped caches to route-only reads** (leads, estimator settings, admin users, shared budget, public estimator, budget lead context and weekly schedule) and connect all read-loading branches to offline fallbacks.
- [x] **Step 4: Run the focused unit and emulator-backed E2E regressions**; cached navigation, the no-cache fallback, offline week retention and toast over an open dialog pass. The weekly E2E also covers the estimated-end-date keyboard editor regression.

### Task 5: Documentation, verification, and Hosting release

**Files:**

- Modify: `docs/plan.md`
- Modify: `docs/state-and-cache.md`
- Modify: `docs/architecture.md`
- Modify: `docs/firebase.md`
- Modify: `docs/styles-and-responsive.md`
- Modify: `docs/performance.md`
- Verify: date editor regression `tests/e2e/app.spec.ts`

- [x] **Step 1: Update the technical docs** to record the session-only memory cache, Firebase failure detection, offline toast and unchanged queued-write policy.
- [x] **Step 2: Run focused regressions** for BG-012, the weekly team flow, and the estimated end-date keyboard editor: emulator-backed E2E 3/3.
- [x] **Step 3: Run the project checks** required by `AGENTS.md`: Rules 61/61 (no Rules changes), focused offline unit tests 30/30, lint, format, build and diff check pass. `pnpm test` is 190/191 because the existing `tests/catalogTradeImport.test.ts` expectation still lists only `reforma_integral`; record this unrelated failure.
- [x] **Step 4: Deploy only Firebase Hosting** to `budgenerator`; Rules and Functions were not deployed.
- [x] **Step 5: Verify the release**: PWA `3750501ae33336f7`, 99/99 static files byte-match `dist`, and `/budgets`, `/projects`, `/team`, `/team/manage` and `/projects/project-navigation` return HTTP 200. Record the release URL and no-production-data-write result in `docs/plan.md`.

## Execution Rulings

- No commits are planned: this isolated worktree already contains the user's in-progress BG-011 changes, and committing whole overlapping files would capture unrelated work. Keep changes reviewable in the existing branch and deploy only after verification.
- Startup migrations and automatic device registration remain unguarded as user mutations; they do not raise a mutation toast just because a background read triggered them. User initiated Firestore and callable writes use the guard; the existing write queue handles buffered edits.
- The combined Hosting deploy also includes the already validated keyboard correction to the BG-011 estimated end-date editor; rerun its E2E regression before release.
- Local snapshots are not encrypted by the app; their privacy boundary is the browser origin/profile plus UID partitioning and cache deletion on account change.

### Task 6: Restore page state after offline reload

**Files:**

- Create: `src/shared/lib/offlineStateCache.ts`
- Modify: `src/shared/lib/memoryResourceCache.ts`
- Modify: `src/app/session.ts`, `src/app/AuthGuard.tsx`, `src/app/PwaStatus.tsx`
- Modify: authenticated Zustand data stores and `src/entities/workforce/model/store.ts`
- Test: `tests/offlineReads.test.ts`, `tests/offlineStateCache.test.ts`, `tests/e2e/app.spec.ts`
- Modify: offline technical documentation

**Interfaces:**

- Store snapshots contain data fields only, not action functions or pending offline mutations.
- Restore private store and route-cache entries before authenticated routes mount; physically offline startup skips remote session reads.
- Resource readers fall back to the matching IndexedDB value after reload. Loaded stores do not replace restored lists with empty SDK results while physically offline.
- Successful online reads and store updates refresh snapshots. Logout or UID change removes only that UID's private records.

- [x] **Step 1: Add regression tests first** for resource restoration after a memory reset, UID-specific store restoration, and offline reload navigation through project detail/list and team schedule.
- [x] **Step 2: Verify RED**: the persisted resource regression failed with `OfflineReadUnavailableError`; the E2E exposed the project list being overwritten by an offline Firestore query.
- [x] **Step 3: Implement IndexedDB persistence, pre-route session restoration, and the offline loaded-store guard.**
- [x] **Step 4: Run focused unit tests, offline E2E, lint, format and build; record results.**
- [x] **Step 5: Deploy only Firebase Hosting**; PWA `5c544c7c6d5b9b69` is live at `https://budgenerator.web.app`. All 99/99 static files match `dist` byte for byte, and `/budgets`, `/projects`, `/team`, `/team/manage` and `/projects/project-navigation` return HTTP 200. No Rules, Functions or production data were changed.

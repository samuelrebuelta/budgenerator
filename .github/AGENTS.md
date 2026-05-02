# Renovation Budget Generator — Agent Instructions

## Project Overview

SPA for creating renovation budgets, exporting them as PDF, and sharing them via public links. Built for Spanish-speaking contractors.

- **Stack:** React 19 + TypeScript 6 + Vite 8 + TailwindCSS 4 + Firebase (Auth, Firestore, Hosting)
- **State:** Zustand 5 (no persist — data syncs to Firestore directly)
- **PDF:** jsPDF 4 (client-side, no server rendering)
- **i18n:** i18next + i18next-http-backend, translations loaded from `/locales/{lng}/translation.json`
- **Package manager:** pnpm (always use `pnpm`, never npm/yarn)
- **Deploy:** `pnpm build && pnpm dlx firebase-tools deploy --only hosting`

## Architecture — Feature-Sliced Design (FSD)

```
src/
├── app/          # Shell: bootstrap, routing, AuthGuard
├── entities/     # Domain stores (Zustand) and business logic
├── pages/        # One folder per route, each with components/
└── shared/       # Reusable: firebase/, i18n/, lib/, types/, ui/
```

**Layer dependency rule:** `shared → entities → pages → app`. Never import upward.

## Routing

| Path | Page | Auth |
|------|------|------|
| `/login` | LoginPage | No |
| `/shared/:token` | BudgetViewerPage | No |
| `/` | BudgetListPage | Yes |
| `/budget/:budgetId` | BudgetGeneratorPage | Yes |
| `/catalog` | CatalogPage | Yes |
| `/profile` | ProfilePage | Yes |

`AuthGuard` wraps protected routes: checks auth, redirects to `/login`, loads initial data.

## Data Model (src/shared/types/index.ts)

```
Budget { id, info: BudgetInfo, workItems: WorkItem[], adjustment?: BudgetAdjustment, ivaRate?, createdAt }
├── BudgetInfo { clientName, address, date, budgetNumber }
├── WorkItem { id, name, tasks: BudgetTask[] }
│   └── BudgetTask { id, description, quantity, unit: Unit, price, cost }
└── BudgetAdjustment { multiplier, reason }

Tariff { id, description, unit, basePrice, cost, category }
CompanyProfile { name, cif, address, phone, email, logo?: string (base64) }
SharedBudget { budget, company, ivaRate, sharedAt }
BudgetTemplate { id, name, workItems, adjustment?, createdAt }
Unit = 'm2' | 'm3' | 'ml' | 'unit' | 'hour'
```

## Zustand Stores (src/entities/)

| Store | Key state | Sync |
|-------|-----------|------|
| `useAuthStore` | user, loading, error | Firebase Auth listener |
| `useBudgetStore` | budgets[], activeBudgetId, draftBudget, loaded | Debounced 1s to Firestore |
| `useTariffStore` | tariffs[], loaded | Immediate to Firestore |
| `useProfileStore` | profile, loaded | Immediate to Firestore |
| `useTemplateStore` | templates[], loaded | Immediate to Firestore |

**Draft/Active pattern:** `draftBudget` is temporary (new budget), `activeBudgetId` points to a persisted budget. Helpers `getActive()` and `updateActive()` abstract which mode is active. `useActiveBudget()` selector returns whichever is current.

**Auth injection:** Stores use `setBudgetAuthGetter(fn)` pattern to inject UID without circular imports.

**Cache:** `loaded` flag prevents re-fetches. Budgets always reload for freshness; tariffs cache until page refresh.

## Firestore Structure

```
users/{uid}/
├── budgets/{budgetId}    → Budget (embedded workItems with tasks)
├── tariffs/{tariffId}    → Tariff
├── templates/{templateId} → BudgetTemplate
└── settings/profile      → CompanyProfile
```

Security rules: users can only read/write their own `/users/{uid}/**`.

## i18n System (src/shared/i18n/)

- **Library:** i18next + i18next-http-backend
- **Config:** `src/shared/i18n/index.ts` — exports `i18nReady` (init promise) and `t` (bound to `i18next.t`)
- **Translations:** `public/locales/es/translation.json` — loaded via HTTP at boot, flat `section.key` structure
- **Usage:** `import { t } from '@/shared/i18n'` then `t('section.key')` or `t('section.key', { 0: value })`
- **Interpolation:** `{{variable}}` format (i18next default). Positional: `{{0}}`, `{{1}}`. Named: `{{pct}}`
- **Plurals:** `key_one` / `key_other` with `{ count: N }`
- **Adding a language:** Create `public/locales/{lng}/translation.json` and update `lng`/`fallbackLng` in config

## UI Components (src/shared/ui/)

- `Button` — variants: primary (default), secondary, danger
- `Input` — styled input with label
- `Select` — styled select with label
- `Modal` — backdrop + slide-up, Escape/click-outside close
- `EditableRow` / `EditableRowHeader` — dual-layout rows (grid on desktop, card on mobile). Supports cell types: text, number, unit-select, display. Used in BudgetEditor and CatalogPage.
- `ExportPdfButton` — triggers PDF generation, opens in new tab on all platforms
- `Skeleton` / `SkeletonList` — loading placeholders

## PDF Generation (src/shared/lib/pdf.ts)

- Uses jsPDF directly (no DOM rendering, no html2canvas)
- `generateBudgetPdf({ budget, company, pdfWindow })` — async, loads logo with proper aspect ratio
- `pdfWindow` is pre-opened in user gesture context (required for iOS Safari popup blocker)
- Layout: company header with logo → client info → work item cards (gray header + separator + tasks) → totals (subtotal, discount, IVA, total)

## Styling Conventions

- **TailwindCSS 4** with `@tailwindcss/vite` plugin (no PostCSS config)
- **Mobile-first:** base styles for mobile, `sm:` breakpoint (640px) for desktop
- `cn()` helper from `src/shared/lib/utils.ts` (clsx + tailwind-merge)
- **Print:** `.no-print` class hides elements; `print:` variant for print-specific styles
- **Touch:** 44×44px minimum targets (WCAG)
- **Colors:** primary blue-600/700, text gray-900/500, borders gray-200/300, danger red-500/600

## Key Patterns

1. **New features** → create page in `src/pages/<name>/`, add route in `router.tsx`, export from `index.ts`
2. **New store** → `src/entities/<name>/model/store.ts`, export from `index.ts`
3. **Shared components** → `src/shared/ui/`, export from `index.ts`
4. **Firebase CRUD** → `src/shared/firebase/firestore.ts`, export from `index.ts`
5. **Barrel exports** → every folder has `index.ts` re-exporting public API
6. **IDs** → `generateId()` from `src/shared/lib/` (uses `nanoid`)
7. **File naming** → PascalCase for components (`Button.tsx`), camelCase for utilities (`utils.ts`)

## Build & Scripts

```bash
pnpm dev              # Vite dev server
pnpm build            # tsc -b && vite build && cp dist/index.html functions/spa.html
pnpm lint             # ESLint
pnpm dlx firebase-tools deploy --only hosting  # Deploy
```

## Safety Rules

- **Never** auto-commit or auto-push. Always ask the user for explicit confirmation.
- **Never** deploy without user approval.
- Firebase config uses env vars (`VITE_FIREBASE_*`) — never hardcode credentials.

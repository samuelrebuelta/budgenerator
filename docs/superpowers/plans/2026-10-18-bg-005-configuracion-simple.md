# BG-005 Simple Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify company estimator setup into a room and per-m² pricing wizard while preserving active legacy links and the lead flow.

**Architecture:** Add a versioned settings schema with room price ranges and a one-euro quality step. Keep the existing catalog-backed schema as a legacy branch in shared calculation logic and Cloud Functions. Render the new pricing model only after the owner saves it; adapt the public form and lead summaries to the new partial/integral behavior.

**Tech Stack:** React, TypeScript, Zustand, Firebase callable Cloud Functions, Firestore, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-18-bg-005-estimador-configuracion-simple-design.md`

## Global Constraints

- UI and documentation remain Spanish; code identifiers remain English.
- Keep the token opaque, random, revocable, and server-resolved.
- Public clients never read estimator settings, unit rates, or catalog documents directly.
- Leads remain until manual deletion; existing lead data and legacy estimator links remain readable.
- No Firestore Rules changes or schema auto-migration.
- No new dependencies.

## Review Focus

- Legacy settings and links remain calculable with the catalog-backed version-1 path.
- Version-2 rates reject invalid ranges, negative increments, duplicate/unsupported rooms, and unsafe areas.
- Integral requests include selected rooms and sum each room’s rate × its own area exactly once.
- Lead history displays historical quality labels without reinterpreting existing leads.
- Publication failures and progress remain visible beside the publish action.

---

### Task 1: Versioned pricing contract and server calculation

**Files:**

- Modify: `src/entities/quote-estimator/model/types.ts`
- Modify: `src/entities/quote-estimator/model/estimate.ts`
- Modify: `src/entities/quote-estimator/index.ts`
- Modify: `functions/src/quoteEstimator.ts`
- Modify: `src/entities/quote-estimator/api/firestore.ts`

**Interfaces:**

- Produce schema-2 settings `{ schemaVersion: 2, rooms, contact }`; each room stores room ID, min/max cents per m² for Media, and a non-negative cents-per-m² step.
- Preserve schema-1 `{ services, contact }` calculation and public response until an owner overwrites it with schema 2.
- `calculateQuoteRange(settings, catalogParts, selections, legacyTariffs?)` validates version-specific selections and returns the same `QuoteEstimate` contract.

- [x] Add schema-versioned types and validation for the five configurable rooms, positive ordered base price bounds, and non-negative quality step.
- [x] Calculate Media from the base range, Alta with one step, and Lujo with two steps; sum each selected room’s range times `areaM2`; preserve the schema-1 catalog calculation.
- [x] Branch the callable handlers to skip catalog reads for schema 2, return available room/scope/quality descriptors without prices, and store the settings version on each lead.
- [x] Keep schema-1 publication, estimate and lead handling unchanged.

### Task 2: Company setup wizard and reliable publication feedback

**Files:**

- Modify: `src/pages/quote-estimator/QuoteEstimatorSettingsPage.tsx`

**Interfaces:**

- The wizard owns a schema-2 draft, an ordered list of selected rooms, and a step index for rooms, prices, and publication.
- Existing `publishEstimatorLink`, `saveQuoteEstimatorSettings`, and revocation API stay callable as before.

- [x] Replace repeated room/scope/quality/concept rows with a room picker and one min/max €/m² range plus quality-step control per selected room.
- [x] Add bounded, labelled 1 €/m² increment/decrement buttons and show the resulting three quality ranges as a concise preview.
- [x] Preserve contact-sharing options and add a clear migration notice when saved settings use schema 1.
- [x] Validate the privacy URL locally before publication; show progress, success and errors at the bottom action, with a visible spinner and changing button copy.

### Task 3: Public scope selection, integral sum, and lead history labels

**Files:**

- Modify: `src/pages/public-quote/QuoteEstimatorPage.tsx`
- Modify: `src/pages/leads/LeadsPage.tsx`
- Modify: `src/pages/budget-detail/BudgetDetailPage.tsx`
- Modify: relevant quote-estimator types if Task 1 requires it

**Interfaces:**

- Public estimator info identifies schema 1 or 2; schema 2 advertises configured rooms and available quality IDs only.
- Schema-2 selections share one scope while retaining per-room area and quality; stored lead response keeps the existing shape plus schema version.

- [x] Keep the current form path for legacy schema 1.
- [x] For schema 2, ask Partial/Integral once, let the visitor select configured rooms and indicate each room’s area and quality, and calculate integral totals by summing those selected rooms.
- [x] Render schema-2 quality labels as Media/Alta/Lujo and preserve schema-1 labels in existing lead and budget context.

### Task 4: Contracts and documentation

**Files:**

- Modify: `docs/plan.md`
- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/firebase.md`
- Modify: `docs/state-and-cache.md`
- Modify: `docs/styles-and-responsive.md`
- Add: `docs/superpowers/specs/2026-10-18-bg-005-estimador-configuracion-simple-design.md`

- [x] Record the new schema, the manual per-m² tariff source, the compatibility boundary, and the exact verification performed.

### Verification

- [x] Run `pnpm lint`, `pnpm build`, `pnpm build:functions`, `pnpm format:check`, and `git diff --check`.
- [x] Do not modify production user documents; redeploy code only under the explicit BG-005 test-deployment authorization already given by the user.

## Resultado

Lint, build web, build de Functions, formato y `git diff --check` completados. No se ejecutaron suites de tests. Despliegue a `budgenerator` completado el 18-10-2026: Hosting responde HTTP 200 y las seis Functions están ACTIVE en `europe-west1`. Se estableció `roles/run.invoker` para `allUsers` en los seis servicios y se comprobó que una llamada sin sesión alcanza el handler y devuelve 401 `UNAUTHENTICATED`. No se publicaron reglas ni se modificaron documentos de Firestore.

## Ampliación posterior: cantidad por estancia

Se añade al formulario un número de estancias por tipo (1–20) y el tamaño aproximado por cada una. El cálculo de ambos esquemas multiplica cantidad por superficie y precio; las selecciones históricas sin cantidad equivalen a una estancia. La bandeja de solicitudes y el contexto de presupuesto muestran la cantidad y superficie total. Se aumenta la altura del selector de plazo. No cambia el enlace transaccional lead-presupuesto ni se importan las respuestas como partidas del presupuesto.

Validación de esta ampliación: `pnpm lint`, `pnpm build`, `pnpm build:functions`, `pnpm format:check` y `git diff --check` correctos; no se ejecutaron suites de tests. `build:functions` avisó que el host usa Node 24 frente al runtime declarado Node 22. Despliegue a `budgenerator` completado con `functions,hosting`; Hosting responde HTTP 200 y las seis Functions siguen en `europe-west1` con Node.js 22. Tras refinar la presentación del contexto en presupuesto, Hosting se publicó de nuevo con PWA `a4a8b7cb2ad6c5fb` y se confirmó HTTP 200. No se publicaron reglas ni se modificaron documentos de Firestore.

## Refinamiento de interacción — 18-10-2026

- [x] Dar a cada estancia física su propio `instanceId`, superficie y calidad; conservar el formato agrupado `quantity` para leads históricos.
- [x] Mantener el enlace accesible en un resumen persistente con acciones de abrir, copiar, revocar y borrar configuración. El borrado revoca primero el enlace y conserva leads.
- [x] Añadir «Estimador» al menú desplegable del header, redirigir la ruta anterior, quitar los retornos a Mi empresa y simplificar sus accesos a «Ver».
- [x] Reutilizar Select a 56 px y mostrar skeletons en la carga pública y privada.
- [x] Actualizar el desglose del lead en solicitudes y en el borrador de presupuesto para distinguir cada estancia.
- [x] Actualizar los selectores del E2E existente para la nueva etiqueta por estancia.

Lint, build web, build Functions, formato, detector de Impeccable y `git diff --check` correctos. No se ejecutaron suites de tests. Se desplegó a `budgenerator` con `--only functions,hosting`; Hosting responde HTTP 200 y las seis Functions están ACTIVE en `europe-west1`. No se publicaron reglas ni se modificaron documentos de Firestore.

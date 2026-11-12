# Análisis del frontend PWA

Revisión del 11-11-2026 sobre `main` en `59d00d2` (rama `claude/project-analysis-improvement-914b89`). Solo cubre el cliente web y la PWA: `src/`, `index.html`, `public/`, la configuración de Vite, el service worker, las pruebas y la CI. Las reglas de Firestore y Functions se citan solo cuando afectan al cliente.

Las métricas se han obtenido con `grep`, un recorrido del AST de TypeScript y la salida real del build. Los números de línea corresponden a ese commit.

## Verificaciones ejecutadas

| Comando             | Resultado real                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`         | Correcto, 0 errores y 0 avisos.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm build`        | Correcto. 77 chunks JS y 95,04 kB de CSS (19,63 kB gzip). El service worker precachea 99 recursos (versión `65b739d5b383f7ae`).                                                                                                                                                                                                                                                                                                                      |
| `pnpm test`         | **Falla.** 43 de 46 ficheros pasan con 209 tests correctos. Fallan 3 ficheros: `tests/fcmDelivery.test.ts`, `tests/leadNotificationJobs.test.ts` y `tests/notificationPreferences.test.ts`. Importan `functions/src/**`, y no están instaladas las dependencias de `functions/` (`firebase-admin`, `firebase-functions`). Es el mismo fallo que muestra la CI de GitHub en `main`: las 6 últimas ejecuciones de «Validate budgenerator» han fallado. |
| `pnpm format:check` | Correcto.                                                                                                                                                                                                                                                                                                                                                                                                                                            |

No se han ejecutado `test:rules`, `test:e2e` ni `test:integration`, porque requieren emuladores.

---

## 1. Resumen ejecutivo

La base funcional es sólida. Hay una sesión con revisión anti-carreras, una cola de escrituras por documento y un offline acotado y bien documentado. La actualización de la PWA es controlada. Las capas FSD se respetan casi sin excepciones. El tipado es estricto: 0 `any`, 0 `@ts-ignore` y 0 `eslint-disable`. Los selectores de Zustand están bien usados.

Lo que impide considerar el código «profesional» está en la capa visual y en el tamaño de las páginas. No hay un sistema de diseño real:

- Los colores se escriben a mano: 436 valores hex arbitrarios en TSX y 218 en CSS, unos 198 colores distintos.
- Hay un `index.css` de 2.636 líneas fuera de capas de cascada, que se impone a Tailwind.
- Las primitivas de UI no cubren los casos reales y las páginas reimplementan botones, campos, avisos y estados vacíos.

Además, la CI lleva días en rojo y nunca llega a ejecutar ni el build ni los tests de integración.

### Nota por área

| Área                          | Nota | Comentario                                                                                                                                        |
| ----------------------------- | :--: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Estilos y sistema visual   |  4   | Tokens mínimos y mal nombrados (`blue-*` es verde); color, radio, tipografía y breakpoints hardcodeados; CSS global sin capas                     |
| 2. Componentes reutilizables  |  5   | Buenas bases (Modal, ConfirmModal, PageHeader, Switch, SwipeActions), pero Button/Input/Card se quedan cortos y se reimplementan                  |
| 3. Tamaño y responsabilidades |  4   | 7 páginas de 600–1.163 líneas; una página atiende 3 rutas; reglas de dominio duplicadas en la UI                                                  |
| 4. Arquitectura FSD           |  7   | Sin violaciones de capa graves; quedan 13 imports internos, 1 import entre páginas y tipos de dominio en `shared`                                 |
| 5. Estado y sincronización    |  7   | Selectores correctos, cola y revisión de sesión robustas; el snapshot offline se reescribe en cada cambio y hay fetch ad hoc en 7 páginas         |
| 6. PWA                        | 7,5  | Actualización, recuperación y offline bien resueltos; el precache es de 2,37 MB (incluye ~373 kB inútiles); faltan detalles de iOS y del manifest |
| 7. Rendimiento                |  6   | Rutas lazy y PDF diferido; carga inicial de 920 kB de JS (289 kB gzip) en 38 modulepreload, con datos semilla de catálogo                         |
| 8. Accesibilidad              |  6   | Diálogos nativos, foco y skip link correctos; contraste insuficiente en grises y terracota, formularios sin `aria-invalid` ni `aria-describedby`  |
| 9. i18n                       |  3   | i18next adoptado a medias: 23 de 80 TSX lo usan, ~700 cadenas hardcodeadas y 94 claves sin uso                                                    |
| 10. Calidad, tests y CI       |  5   | Tipado excelente; CI rota, sin tests de componentes ni de accesibilidad, ESLint mínimo, 110 `as` en adaptadores Firestore                         |

### Top 10 problemas

| #   | Severidad | Problema                                                                                                                                                                                                                                             | Evidencia                                                                                                  |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Alta      | La CI de `main` falla en `pnpm test`; `test:integration` y `build` nunca se ejecutan en CI                                                                                                                                                           | `.github/workflows/ci.yml:22-27`, `tests/fcmDelivery.test.ts`                                              |
| 2   | Alta      | No hay tokens semánticos de color: 436 hex arbitrarios `[#…]` en 27 TSX (121 valores fuera de la paleta) y 218 hex en `index.css`. La paleta `blue-*` está remapeada a verde petróleo                                                                | `src/index.css:17-40`, `src/pages/project-detail/ProjectDetailPage.tsx` (55 hex)                           |
| 3   | Alta      | `index.css` (2.636 líneas, ~300 reglas por pantalla) vive fuera de `@layer`, de modo que gana a cualquier utilidad de Tailwind. Obliga a usar `!important`/`!px-3` y vuelve inertes clases como `rounded-lg` en botones                              | `src/index.css:1594-1600`, `src/pages/project-detail/ProjectProgressHistoryDialog.tsx:49-50`               |
| 4   | Alta      | Primitivas insuficientes: `Button` no tiene tamaño ni variante de icono. Hay 50 `<button>` crudos con 49 `className` distintos. `Input` y `Select` usan focos diferentes y ningún campo expone error ni ayuda accesible                              | `src/shared/ui/Button.tsx:7-12`, `src/shared/ui/Input.tsx:19`, `src/shared/ui/Select.tsx:27`               |
| 5   | Alta      | Páginas monolíticas: `WorkforcePage` atiende 3 rutas con 22 `useState`; `WeeklyProjectSchedule` mezcla gesto, filtro, datos y render en 1.163 líneas; `ProjectDetailPage` contiene 2 formularios y 18 `useState`                                     | `src/app/router.tsx:56-61`, `src/pages/workforce/WorkforcePage.tsx:105-139`                                |
| 6   | Media     | Reglas de dominio duplicadas o en la UI: el progreso de proyecto se calcula en 3 sitios; 3 copias de `userFacingError` muestran al usuario `error.message` en crudo; los formateadores de moneda y fecha están repetidos en ≥10 sitios               | `ProjectDetailPage.tsx:43`, `entities/project/model/progress.ts:4`, `entities/project/api/firestore.ts:52` |
| 7   | Media     | i18n a medias: `t()` solo en 23 de 80 TSX, ~700 cadenas literales, 94 claves sin uso; la librería se carga para un único idioma                                                                                                                      | `src/shared/i18n/index.ts:1-11`                                                                            |
| 8   | Media     | Carga inicial de 920 kB de JS (289 kB gzip) en 38 modulepreload. Incluye los catálogos semilla (~2.300 líneas de datos) y los stores de proyecto, equipo y notificaciones                                                                            | `dist/index.html`, `src/entities/catalog/model/store.ts:8`                                                 |
| 9   | Media     | El service worker precachea 2,37 MB. Ahí entran `html2canvas`, `purify` y los polyfills de `canvg` (~373 kB) que jsPDF nunca usa en este proyecto, además de `logo.png`, `social-preview.png` y el JSON de traducciones, que ya va dentro del bundle | `scripts/build-sw.mjs:4-9`                                                                                 |
| 10  | Media     | Los adaptadores Firestore no validan nada: 110 aserciones `as` (28 en `project/api/firestore.ts`) y 0 `withConverter`. Un documento malformado rompe la UI o los cálculos                                                                            | `src/entities/project/api/firestore.ts:263,291,356,840`                                                    |

### Pendiente de la auditoría histórica (`docs/project-analysis.md`, 04-10-2026)

Ya están resueltos: los errores de lint, el foco y el confinamiento en modales, el offline y la actualización de la PWA, y el chunk principal monolítico. **Siguen pendientes:**

- Los chunks de `html2canvas` y DOMPurify se siguen emitiendo y ahora además se precachean (§6, §7).
- La extracción de textos y la integración reactiva de i18n (§9).
- La validación de esquema de datos remotos (§10).
- La paginación remota de presupuestos (`docs/performance.md`).
- `CatalogSelector` sigue suscrito al presupuesto completo mediante `useActiveBudget()` (`src/features/budget-editor/ui/CatalogSelector.tsx:19`).
- La revisión de accesibilidad con lector de pantalla.

---

## 2. Estilos

### Métricas

| Métrica                                          | Valor                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Líneas de `src/index.css`                        | 2.636 (≈ 9,5 % de todo `src/`)                                                                                                                                                              |
| Reglas de clase de primer nivel en CSS           | ~301; prefijos dominantes `catalog-*` (35), `structure-*` (28), `budget-*` (23)                                                                                                             |
| Hex en CSS                                       | 218 apariciones, 87 únicos (59 fuera de la paleta del `@theme`); solo 18 `var(--…)`                                                                                                         |
| Hex arbitrarios en TSX (`bg-[#…]`, `text-[#…]`…) | 436 apariciones, 132 únicos, 27 ficheros; 121 valores no existen en el `@theme`                                                                                                             |
| Colores distintos en la app (CSS + TSX)          | ~198                                                                                                                                                                                        |
| `!important` en CSS                              | 16; 12 justificados (print y reduced-motion) y 4 por guerra de especificidad (`1208`, `1581`, `1764`, `1894`)                                                                               |
| Importancia de Tailwind (`!px-3`…)               | 5, todos en `ProjectProgressHistoryDialog.tsx:49-50`                                                                                                                                        |
| Tamaños de fuente distintos en CSS               | 25 (de 8 px a 40 px, más 3 `clamp`), 9 de ellos ≤ 11 px                                                                                                                                     |
| `text-xs` / `text-[10px]` / `text-[11px]` en TSX | 142                                                                                                                                                                                         |
| Radios distintos en CSS                          | 16 (6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 24 px…); en TSX `rounded`, `-md`, `-lg`, `-xl`, `-2xl` y `-full`                                                                                    |
| `z-index` distintos                              | 9 en CSS (1, 40, 45, 50, 60, 80, 90, 200), más `z-30` y `z-50` en TSX                                                                                                                       |
| Breakpoints distintos                            | CSS: 800, 640, 639, 650, 600, 420, 381, 380, 1100 y 1500 px; TSX: `sm:` (156), `lg:`, `xl:`, `md:`, `min-[640px]`, `min-[801px]`                                                            |
| `dark:` / `prefers-color-scheme`                 | 0 / 0                                                                                                                                                                                       |
| `style={{…}}` inline                             | 14 en 8 ficheros (la mayoría colores dinámicos de cuadrillas, que es correcto)                                                                                                              |
| Clases CSS sin uso en TSX                        | 14 candidatas: `catalog-list*` (5), `catalog-back`, `catalog-default-badge`, `catalog-detail-heading`, `catalog-name-panel`, `eyebrow`, `sidebar-note`, `small-cross`, `structure-popular`… |

### Hallazgos

**E1 · Alta · No hay capa semántica de tokens.**

- **Evidencia.** `src/index.css:17-40` solo redefine las escalas `blue-*` y `gray-*` de Tailwind. Por eso `bg-blue-600` pinta verde taller (`#24564c`).
  - El `@theme` no define `primary`, `surface`, `ink`, `muted`, `border`, `accent`, `danger` ni `success`.
  - Las páginas recientes (BG-009/BG-011) han abandonado incluso esas escalas y usan hex directos. Los más repetidos: `#637166` (38), `#52625a` (32, que es `gray-600`), `#1f2b26` (27), `#426457` (24) y `#234c40` (17).
  - Ningún valor del documento de identidad (`docs/design-proposal.md`) está expuesto como token con nombre de marca.
- **Por qué importa.** Un cambio de marca o de contraste requiere tocar más de 650 sitios. Cada pantalla nueva inventa su gris, y no se puede introducir modo oscuro ni temas.
- **Propuesta.**
  1. Añadir en `@theme` tokens semánticos que referencien la paleta: `--color-surface`, `--color-surface-muted`, `--color-ink`, `--color-ink-muted`, `--color-line`, `--color-primary`, `--color-primary-strong`, `--color-accent` (terracota), `--color-danger-*`, `--color-success-*` y `--color-warning-*`.
  2. Hacer un codemod de los 121 hex fuera de la paleta. Antes, mapear cada uno a su token más cercano por ΔE; muchos son variaciones accidentales (`#637166`/`#68756e`/`#6c786f`, `#52625a`/`#56635b`).
  3. Renombrar `blue-*` a `brand-*` en una segunda fase.
  4. Añadir una regla de lint (o un script en CI) que prohíba `\[#[0-9a-f]` en TSX.

**E2 · Alta · El CSS global se impone a Tailwind.**

- **Evidencia.** Las únicas reglas en capa son dos bloques `@layer base` (`src/index.css:171`, `1569`); el resto del fichero está fuera de capa. En Tailwind 4 las utilidades viven en `@layer utilities`, así que **cualquier** regla sin capa les gana, sea cual sea su especificidad.
  - `src/index.css:1594-1600` fuerza `border-radius: var(--button-radius)` en todo `button` sin `rounded-full`. Las 11 clases `rounded-lg/md/xl` escritas en `<button>` no tienen efecto.
  - `.modal-overlay` (`1345`) obliga a usar `!box-border !px-3 !py-4` en `ProjectProgressHistoryDialog.tsx:49`.
  - `h1` se redimensiona en tres sitios, dos con `!important` (`1208`, `1764`).
- **Por qué importa.** El comportamiento de una clase depende de un fichero lejano y el código engaña al lector.
- **Propuesta.**
  1. Envolver las reglas de componentes en `@layer components` y las de base en `@layer base`.
  2. Sustituir la regla global de radio por la variante del componente `Button`.
  3. Dividir `index.css` en `src/app/styles/{tokens,base,shell,print,motion}.css` y CSS co-ubicado por feature (`pages/catalogs/catalog.css`…), importado desde la página lazy. Así el CSS de `/catalog` no viaja en la carga inicial (hoy son 95 kB en un único fichero).
  4. Eliminar las 14 clases muertas.

**E3 · Media · Escalas de tipografía, radio, sombra y `z-index` sin definir.**

- **Evidencia.** Son 25 tamaños de fuente en CSS y 16 radios. Hay sombras ad hoc como `shadow-[0_12px_36px_rgba(20,45,35,0.18)]` en `src/features/notifications/ui/ForegroundNotificationHost.tsx:47`, y 9 niveles de `z-index` sin escala.
  - `docs/styles-and-responsive.md` fija las tarjetas en 14 px, pero el código usa 12, 13, 14 y 16 px más `rounded-xl/2xl`.
- **Propuesta.**
  - Definir en `@theme` `--text-*` (como máximo 7 pasos), `--radius-{control,card,sheet,pill}`, `--shadow-{card,popover,toast}` y una escala `--z-{sticky,nav,popover,modal,toast}`.
  - Retirar los tamaños de 8 y 9 px.

**E4 · Media · Breakpoints divergentes.**

- **Evidencia.** El breakpoint de la shell es 800 px en CSS (`src/index.css:1117`, `1495`, `1526`), que no coincide con ningún breakpoint de Tailwind (`md` = 768 px). Se compensa con `min-[801px]:` arbitrario. Hay además 639/640/650/600 px para casos parecidos.
- **Propuesta.** Declarar `--breakpoint-shell: 50.0625rem` en `@theme` y usar `shell:`/`max-shell:` en TSX y `@media (width >= theme(--breakpoint-shell))` en CSS. Unificar 600/639/640/650 en `sm`.

**E5 · Media · Estados de foco inconsistentes.**

- **Evidencia.** El foco global es terracota `#c65d3b` (`src/index.css:199-202`). Los demás controles usan otros:
  - `Input`: anillo `blue-500` (`src/shared/ui/Input.tsx:19`).
  - `Select`: `#426457` (`Select.tsx:27`).
  - `<input>` crudos de BG-011: outline `#b7694d`.
  - Toggles: `outline-[#426457]` (`BudgetHeader.tsx:68`).
  - Checkboxes: `accent-[#24564c]` y `accent-[#426457]` a la vez.
- **Propuesta.** Un token `--color-focus` y una única utilidad `@utility focus-ring` reutilizada por todas las primitivas.

**E6 · Baja · Sin modo oscuro ni `color-scheme`.**

- **Evidencia.** Hay 0 `dark:`. No se declara `color-scheme: light`, así que en Android con tema oscuro los controles nativos y el autofill pueden mezclar estilos. `theme-color` es único (`index.html:7`).
- **Propuesta.** Declarar `color-scheme: light` ahora. El modo oscuro es una decisión de producto: con E1 resuelto cuesta poco.

---

## 3. Componentes

### Inventario de `src/shared/ui` (23 componentes, 1.388 líneas)

Son sólidos `Modal` (diálogo nativo, trampa de foco, restitución), `ConfirmModal` (estado de guardado y error), `PageHeader`/`BackButton`, `Switch`, `SwipeActions`, `InfoPopover`, `EditableRow` y `Skeleton`.

Son débiles:

- `Button`: 4 variantes, sin `size` ni `icon`.
- `Input`: sin `error` ni `hint`, y el `label` solo funciona si se pasa `id`.
- `Card`: un único estilo, con sombra que el resto de tarjetas no usa.
- `Select`: el SVG de la flecha está embebido en la clase.

Hay dominio dentro de `shared`: `BudgetLimitReached` y `ExportPdfButton`.

### Reimplementaciones y candidatos

| Candidato                                   | Evidencia (`archivo:línea`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Propuesta                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **IconButton** (círculo de 44 px)           | `ProjectDetailPage.tsx:276`; `WorkforcePage.tsx:481,489,500`; `WeeklyProjectSchedule.tsx:859,879`. Además, 4 `<Button className="h-11 w-11 … rounded-full p-0">`                                                                                                                                                                                                                                                                                                                                                | `<IconButton label icon variant size="md                                                                                             | sm">`: obliga a `aria-label` y fija el tamaño táctil |
| **Button `size`**                           | 50 `<button>` crudos con 49 `className` distintos (27 ficheros; los que más, `WeeklyProjectSchedule` 6 y `BudgetSummary` 5)                                                                                                                                                                                                                                                                                                                                                                                     | Añadir `size: sm                                                                                                                     | md                                                   | lg`, `fullWidth`y la variante`link`; migrar los botones crudos que no sean controles especiales |
| **Field** (label + control + ayuda + error) | 47 `<input>` crudos frente a 32 `<Input>`. Hay al menos 12 estilos distintos de campo (`rounded-md`, `rounded-lg`, `rounded`; bordes `gray-300`, `gray-200`, `#c9cfc7`). Solo 8 `htmlFor` para 44 `<label>`, con 0 `aria-invalid` y 1 `aria-describedby`                                                                                                                                                                                                                                                        | `Field` que genere `id`, enlace `aria-describedby` y `aria-invalid`; `Input`, `Textarea`, `Select` y `Checkbox` como controles puros |
| **Alert / InlineError**                     | 17 `field-error`, más 11 variantes ad hoc de `role="alert"`: `rounded-lg bg-red-50 … text-red-700`, `text-[#83452f]`, `bg-[#fff5f2] … text-[#8a3f30]`, `border-[#dfb7a9] bg-[#fff8f4] … text-[#743f31]`…                                                                                                                                                                                                                                                                                                        | `<Alert tone="danger                                                                                                                 | warning                                              | info                                                                                            | success">`y`<FieldError>`                                                          |
| **EmptyState**                              | `BudgetsPage.tsx:238`, `CatalogDetailPage.tsx:511`, `LeadsPage.tsx:294`, `WorkforcePage.tsx:717`, `ProjectTeamAssignments.tsx:179,269`, `DailyProjectAssignmentsDialog.tsx:168,239`, `NewTeamJobForm.tsx:311`, `ProjectDetailPage.tsx:632`, `NotificationSettings.tsx:261`… Cada uno con su color y su espaciado                                                                                                                                                                                                | `<EmptyState icon title description action>`; `OfflineUnavailable` pasa a ser una instancia de este componente                       |
| **CollapsibleSection**                      | 3 `div role="button"` con teclado manual y la misma cadena de clases: `BudgetHeader.tsx:68`, `BudgetDetailPage.tsx:461`, `BudgetEditor.tsx:177`. Más `<details>` en `ProjectDetailPage.tsx:378,511`                                                                                                                                                                                                                                                                                                             | Componente con `<button aria-expanded aria-controls>` y la utilidad `.collapsible` existente                                         |
| **Modal con tamaños / Sheet**               | 7 overrides de `panelClassName`/`overlayClassName`: `category-import-panel`, `structure-panel`, `catalog-picker-panel`, `max-w-2xl max-h-[90vh] … p-0`, `!w-[calc(100vw-3rem)]`…                                                                                                                                                                                                                                                                                                                                | `size="sm                                                                                                                            | md                                                   | lg                                                                                              | sheet"`y slots`ModalHeader`, `ModalBody`y`ModalFooter` con scroll interno estándar |
| **Toast unificado**                         | 3 superficies distintas: `ToastHost` (diálogo no modal), `ForegroundNotificationHost.tsx:47` (`div` fijo con sombra propia) y los banners de `PwaStatus`                                                                                                                                                                                                                                                                                                                                                        | Un `toast` store con tonos y prioridad, renderizado por `ToastHost`                                                                  |
| **Badge / StatusPill**                      | `WorkforcePage.tsx:58` (`StatusBadge` local) frente a `entities/project/ui/ProjectStatusTag.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                | `<Badge tone>` en `shared/ui`; las entidades solo mapean estado → tono y texto                                                       |
| **Card con variantes**                      | 33 `<Card>` frente a 22 `div` de tarjeta ad hoc (`rounded-xl/2xl border bg-white                                                                                                                                                                                                                                                                                                                                                                                                                                | [#…]`), sobre todo en `WeeklyProjectSchedule`(4) y`ProjectDetailPage` (3)                                                            | `<Card variant="plain                                | muted                                                                                           | interactive" padding>`; quitar la sombra por defecto                               |
| **Hook de recurso de ruta**                 | 7 páginas reimplementan el patrón «flag `active` + `loadMemoryResource` + clave + error + intento de reintento»: `LeadsPage.tsx:103`, `WorkforcePage.tsx:179`, `BudgetDetailPage.tsx:124,163`, `BudgetViewerPage.tsx:36`, `QuoteEstimatorPage.tsx:63`, `QuoteEstimatorSettingsPage.tsx:119`, `ProjectDetailPage.tsx:117-140`                                                                                                                                                                                    | `useRouteResource(key, loader, { enabled, refreshVersion })` en `shared/lib`, que devuelva `{ data, status, error, retry }`          |
| **Formateadores**                           | Moneda: `QuoteEstimatorPage.tsx:29`, `QuoteEstimatorSettingsPage.tsx:57`, `LeadsPage.tsx:38`, `BudgetDetailPage.tsx:443,448`, `CatalogSelector.tsx:98`, `BudgetStructureButton.tsx:241`. Fecha: `dateLabel` ×4 (`ProjectsPage.tsx:10`, `ProjectDetailPage.tsx:25`, `ProjectProgressHistoryDialog.tsx:13`, `ProjectTaskCompletionDate.tsx:13`). Claves de día: `dateFromKey` ×2 y `localDateKey` ×2 (`WorkforcePage.tsx:45,53`, `WeeklyProjectSchedule.tsx:80`, `entities/project/model/dailyAssignments.ts:33`) | `shared/lib/format.ts` (`formatEuros`, `formatCents`, `formatQuantity`, `formatLongDate`) y `shared/lib/dateKey.ts`                  |

---

## 4. Tamaño y responsabilidades

| Fichero                                                 |        Líneas | `useState` | `useMemo` | Problema principal                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------: | ---------: | --------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/workforce/WeeklyProjectSchedule.tsx`             |         1.163 |          9 |        12 | Gesto de swipe con pointer events y animación (`568-655`), filtro `<details>` con listener global (`987-998`), dos funciones `renderDay`/`renderWeek` de ~300 líneas (`693-985`) y helpers de fecha propios (`80-115`) |
| `pages/workforce/WorkforcePage.tsx`                     |           942 |     **22** |         3 | Atiende `/team`, `/team/manage` y `/team/jobs/new` (`router.tsx:56-61`): carga y precarga de semanas, roster, 2 modales de alta y edición y el formulario de trabajo                                                   |
| `pages/public-quote/QuoteEstimatorPage.tsx`             |           804 |         13 |         3 | Formulario público con carga, cálculo, contacto y envío en un solo componente                                                                                                                                          |
| `pages/catalogs/CatalogDetailPage.tsx`                  |           801 |         18 |         3 | `CatalogEditor` (`65-782`) contiene edición, filtro, expandir/contraer, importador por categoría y diálogo de catálogo base                                                                                            |
| `pages/project-detail/ProjectDetailPage.tsx`            |           786 |         18 |         0 | Formulario de ampliaciones (6 estados), diálogo de metadatos (4 estados), anulaciones y progreso por partida (`43-64`); sincroniza budget y project desde la UI (`79-80`)                                              |
| `pages/quote-estimator/QuoteEstimatorSettingsPage.tsx`  |           763 |         13 |         2 | Wizard de 3 pasos y resumen de enlace en un componente; parseo de euros en la página (`57-75`)                                                                                                                         |
| `pages/budget-detail/BudgetDetailPage.tsx`              |           612 |          8 |         0 | 6 `useEffect` (lead, draft, bloqueo de salida) y 4 `ConfirmModal`                                                                                                                                                      |
| `entities/project/api/firestore.ts`                     |           950 |          – |         – | Una sola factoría `createProjectFirestoreApi` (`124`) con conversión, progreso, suplementos, anulaciones, asignaciones diarias y metadatos; recalcula el progreso (`52-122`)                                           |
| `entities/catalog/model/catalog.ts` / `baseCatalogs.ts` | 1.066 / 1.235 |          – |         – | Son casi solo datos (`DEFAULT_TARIFFS` en `34-1055`, `BASE_CATALOGS`/`TRADE_CATALOGS`) y van en la carga inicial                                                                                                       |

**T1 · Alta · Una página, tres rutas.** `WorkforcePage` decide qué pintar según `useParams`/`useSearchParams`. Por eso acumula el estado de las tres pantallas y vuelve a montarlo al cambiar de ruta.

- **Propuesta.** `TeamSchedulePage`, `TeamManagePage` y `NewTeamJobPage` como rutas lazy separadas. El estado de semana y filtro, que `docs/state-and-cache.md` exige conservar, pasa a un pequeño store `teamScheduleView` o al `location.state`.

**T2 · Alta · `WeeklyProjectSchedule` mezcla infraestructura y vista.**

- **Propuesta.**
  - Extraer `useWeekSwipe(ref, { onCommit })` (líneas 357-655) a `shared/ui` o a `pages/workforce/model`.
  - Crear los componentes `WeekHeader`, `ResourceFilterPopover`, `DayColumn`, `ProjectDayCard` y `TeamJobDayCard` (estos dos ya existen como funciones locales: `150`, `248`).
  - Mover los selectores puros (`dayAssignments`, `rowsByDate`, `jobsByDate`) a `entities/project/model/dailyAssignments.ts`, donde ya viven funciones análogas y que es testeable.

**T3 · Media · Reglas de dominio en la UI y duplicadas.**

- **Progreso.** Se calcula en `entities/project/model/progress.ts:4` (con guardas de números finitos), en `entities/project/api/firestore.ts:52` (incremental) y en `ProjectDetailPage.tsx:43` (`workItemProgress`, sin esas guardas). Una partida con importe `NaN` da resultados distintos según la vista.
- **Errores.** `userFacingError`/`errorText` existen en `ProjectDetailPage.tsx:33`, `WorkforcePage.tsx:28` y `ProjectTeamAssignments.tsx:40`. Detectan errores por subcadena (`'permission'`, `'offline'`) y, en el resto de casos, **devuelven `error.message` en crudo**, que puede ser un texto en inglés de Firebase. El patrón `e instanceof Error ? e.message : …` aparece 10 veces más, por ejemplo en `ConfirmModal.tsx:35`.
- **Propuesta.**
  1. `calculateWorkItemProgress` en `entities/project/model/progress.ts`, reutilizada por las tres rutas.
  2. `toUserMessage(error, context)` en `shared/lib/errors.ts`, que clasifique por `FirebaseError.code` (no por el texto) y nunca muestre mensajes técnicos.

**T4 · Media · Entidades con datos estáticos y API monolítica.**

- **Propuesta.**
  - Mover `DEFAULT_TARIFFS`, `BASE_CATALOGS` y `TRADE_CATALOGS` a módulos de datos cargados con `import()` solo al migrar o al abrir el importador.
  - Partir `project/api/firestore.ts` por agregado: `conversion`, `progress`, `supplements`, `dailyAssignments` y `metadata`, manteniendo la factoría como fachada.

---

## 5. Arquitectura FSD

**Lo que funciona.** No hay imports de `shared` hacia capas superiores, ni de `entities` hacia `features`/`pages`/`app`, ni de `features` hacia `pages`/`app`, ni entre features. Las rutas son lazy por página.

**A1 · Media · Imports a internos que saltan la API pública (13).**

- `src/app/session.ts:11-17` importa `@/entities/{budget,catalog,profile,template,user}/model/store`, aunque `project` y `workforce` sí usan su índice.
- `pages/budget-detail/components/ShareButton.tsx:5` y `pages/budget-viewer/BudgetViewerPage.tsx:3` importan `entities/budget/api/firestore`.
- `pages/login/LoginPage.tsx:10` y `pages/account/ChangePasswordPage.tsx:3` importan `entities/auth/api/firebase`.
- `pages/project-detail/ProjectTaskCompletionDate.tsx:2` y `ProjectProgressHistoryDialog.tsx:2` importan `entities/project/model/history`.
- `features/budget-structure/model.ts:2` importa `entities/catalog/search`.
- **Propuesta.** Exportarlos desde los `index.ts` y añadir una regla `no-restricted-imports` con el patrón `@/entities/*/*`. No requiere dependencias nuevas.

**A2 · Baja · Import entre páginas.** `pages/project-detail/ProjectDetailPage.tsx:18` importa `@/pages/projects/ProjectProgressBar`.

- **Propuesta.** Moverlo a `entities/project/ui`, junto a `ProjectStatusTag`.

**A3 · Media · Dominio dentro de `shared`.**

- **Evidencia.**
  - `src/shared/types/index.ts` define `Budget`, `WorkItem`, `BudgetTask`, `Tariff`, `CatalogPart` y tipos de equipo.
  - `shared/lib/budgetMath.ts` y `shared/lib/pdf.ts` conocen el presupuesto.
  - `shared/ui/BudgetLimitReached.tsx` y `shared/ui/ExportPdfButton.tsx` son de negocio. Además, `pages/budget-detail/components/ExportPdfButton.tsx` solo reexporta el de `shared`.
- **Por qué importa.** La regla «`shared` no importa entidades» se cumple formalmente porque el dominio se ha bajado a `shared`.
- **Propuesta.** Mover los tipos a `entities/budget/model/types.ts` y `entities/catalog/model/types.ts`, y el PDF a `features/budget-export`. `quote-estimator` importa `../../../shared/types/index.js` por compatibilidad con Functions (`entities/quote-estimator/model/estimate.ts:1`). Conviene un paquete `src/shared/contracts` explícito para lo que comparte con Functions.

**A4 · Baja · Dependencias entre entidades.** `entities/project/api/firestore.ts:18-19` usa la serialización de `budget`; `budget` depende de `user`. Son aceptables, pero deben pasar por la API pública.

**A5 · Baja · Las traducciones se importan desde `public/`.** `src/shared/i18n/index.ts:2` importa `../../../public/locales/es/translation.json`. El JSON se empaqueta en JS y además se publica y precachea como fichero estático.

- **Propuesta.** Moverlo a `src/shared/i18n/es.json`.

---

## 6. Estado

**Lo que funciona.**

- Hay 186 suscripciones con selector y una sola sin él (`src/app/AuthGuard.tsx:23`, `useSessionStore()`, inocuo porque el store es pequeño).
- No hay selectores que creen arrays nuevos; `TemplateDetailPage.tsx:27` usa `find`, que devuelve una referencia estable.
- `WriteQueue` coalesce, serializa y reintenta.
- La revisión de sesión descarta respuestas obsoletas.
- `resetSession` limpia memoria, IndexedDB y borradores.

**S1 · Media · El snapshot offline se reescribe en cada `setState`.** `src/shared/lib/offlineStateCache.ts:194-198` suscribe cada store y llama a `writeOfflineValue` en **todos** los cambios, sin debounce ni comparación. En el editor de presupuestos, cada pulsación clona la lista completa de presupuestos hacia IndexedDB (`registerOfflineStore('budgets'…)` en `entities/budget/model/store.ts:458`).

- **Propuesta.** Agrupar con `requestIdleCallback` o un debounce de 500–1.000 ms por clave, comparar las referencias de los campos seleccionados antes de escribir y vaciar en `pagehide`. Medir antes y después con el panel Performance y documentos grandes.

**S2 · Media · Lógica de carga duplicada en páginas.** Ver el hook `useRouteResource` en §3. Cada página gestiona su propio flag `active`, sus estados `loadAttempt` y `loadResult.key` y el refresco por `dataRefreshVersion`. `ProjectDetailPage.tsx:83-115` deriva `loading`, `missing` y `error` con 6 condiciones.

**S3 · Media · Orquestación entre stores en la UI.** `ProjectDetailPage.tsx:79-80` toma `updateProjectMetadata` del store de proyecto y `syncLinkedProjectMetadata` del de presupuesto, y los coordina en el componente.

- **Propuesta.** Una acción de feature (`features/project-metadata`) o un caso de uso en `app` que actualice ambos stores tras la transacción.

**S4 · Baja · Re-render del editor (pendiente histórico).** `CatalogSelector`, `AddTaskButton`, `AddWorkItemButton` y `BudgetEditor` usan `useActiveBudget()` (el documento completo). Con `memo`, `CatalogSelector` sigue re-renderizándose en cada edición.

- **Propuesta.** Selectores finos: `catalogId`, los IDs de capítulos y la longitud.

**S5 · Baja · Stores eager.** `app/session.ts` importa los stores de proyecto, workforce y catálogo. Cargarlos en la sesión obliga a incluir su código y sus datos en la carga inicial (§8), aunque `workforce` no se use al arrancar (`docs/state-and-cache.md`, BG-011).

---

## 7. PWA

**Lo que funciona.**

- Precache versionado por hash (`scripts/build-sw.mjs`).
- Activación diferida hasta la acción del usuario, que además vacía las colas antes (`src/app/PwaStatus.tsx:66-87`).
- Conserva una versión anterior para las pestañas abiertas.
- Rechaza HTML servido como JS y no cachea Firebase.
- `recovery.js` y `offline.html` para arranques fallidos.
- Comprobación de actualización al volver a la pestaña o recuperar la red, y cada hora.
- Push con FCM cargado bajo demanda (`features/notifications/model/push.ts:51`).
- Captura de `beforeinstallprompt` antes del render (`app/pwaInstall.ts`).
- Cabeceras de Hosting correctas para `sw.js`, `index.html` y `/assets/**`.

**P1 · Media · Precache inflado (2,37 MB, 99 recursos).** `build-sw.mjs:4-9` precachea **todo** `dist/`. Sobran:

- `html2canvas` (199,6 kB), `purify.es` (22,4 kB) e `index.es` (151,4 kB, polyfills de `core-js` para `canvg`). Son dependencias opcionales de jsPDF que `src/shared/lib/pdf.ts` no usa: no llama a `.html()` ni a SVG.
- `logo.png` (54,8 kB) e `icons.svg`, sin referencias en `src/` ni en `index.html`.
- `brand/social-preview.png` (56,2 kB) y su `.svg`, que solo sirven para Open Graph.
- `locales/es/translation.json` (ya va en el bundle), `brand/licenses/*.txt` y `manifest.json`.

En la primera instalación, un móvil descarga ~0,5 MB que nunca usa, y lo vuelve a hacer en cada despliegue.

- **Propuesta.**
  1. Un `resolve.alias` en `vite.config.ts` hacia un stub vacío para `html2canvas`, `dompurify` y `canvg`, verificando con `tests/pdf.test.ts` y una exportación real.
  2. Una lista de exclusión en `build-sw.mjs` (`social-preview.*`, `licenses/`, `logo.png`, `locales/`).
  3. Retirar `public/logo.png` e `icons.svg` si se confirma que no se usan fuera de la app (correos, Functions).

**P2 · Media · iOS standalone incompleto.**

- `index.html:8` usa solo `apple-mobile-web-app-capable`, que está obsoleto; conviene añadir `mobile-web-app-capable`.
- No hay `apple-touch-startup-image`, así que iOS muestra una pantalla en blanco al abrir la PWA instalada.
- `apple-mobile-web-app-status-bar-style` es `default`. Es coherente con que el header use `safe-area-inset-top` solo en CSS (3 usos), pero no se ha comprobado en un dispositivo real, como ya reconocen `docs/plan.md` y `docs/styles-and-responsive.md`.
- **Propuesta.** Generar los splash con `scripts/build-icons.mjs` (ya usa `sharp`) para los 4–6 tamaños de iPhone más comunes y validar en dispositivo con la checklist de BG-007.

**P3 · Baja · Manifest mejorable.** `public/manifest.json`:

- No tiene `screenshots`, que Chrome Android necesita para la interfaz de instalación enriquecida.
- El segundo `shortcut` no tiene icono.
- `display_override: ["standalone"]` es redundante.
- `orientation: "portrait"` también afecta a tablets y escritorio instalado. Conviene revisarlo con producto.
- La descripción («Tu oficio, tus números…») no coincide con la de `index.html`.

**P4 · Baja · Nombre heredado `cimbra`.** Hay 14 referencias en caché, eventos y claves de borradores (`public/sw.js:2-4`, `src/main.tsx:15`, `src/app/session.ts`). Solo es cosmético, pero renombrar exige migrar las claves (`cimbra-draft:*`) y la limpieza de cachés. Documentarlo en lugar de cambiarlo, salvo que se haga junto con otra migración.

**P5 · Baja · Selección de la versión anterior.** `public/sw.js:29-31` elige la caché previa con `.slice(-1)` sobre `caches.keys()`. El orden es de inserción, lo que funciona, pero no es explícito.

- **Propuesta.** Guardar la versión anterior en una entrada de metadatos de la caché.

---

## 8. Rendimiento

**Datos del build.**

| Grupo                                                    | Tamaño   | Gzip     |
| -------------------------------------------------------- | -------- | -------- |
| JS inicial (entry + 37 modulepreload)                    | 920,6 kB | 289,0 kB |
| `firebase-firestore`                                     | 268,6 kB | 82,7 kB  |
| `ui` (react-router, i18next, lucide, barrel `shared/ui`) | 201,5 kB | 65,1 kB  |
| `react-core`                                             | 189,6 kB | 59,7 kB  |
| `firebase-auth`                                          | 86,8 kB  | 25,5 kB  |
| `store-*` (catálogo con datos semilla)                   | 33,6 kB  | 9,1 kB   |
| `project-*` (store y API de proyecto, inicial)           | 31,5 kB  | 9,2 kB   |
| CSS único                                                | 95,0 kB  | 19,6 kB  |
| Fuentes (Manrope + Fraunces)                             | 61,5 kB  | —        |
| PDF (diferido)                                           | 403,5 kB | 131,3 kB |
| Página más pesada (`workforce`)                          | 55,3 kB  | 14,4 kB  |

En la auditoría de octubre el JS principal ocupaba 853 kB en un solo chunk. Hoy está mejor repartido, pero el **peso inicial total no ha bajado**.

**R1 · Media · Carga inicial con código que no hace falta para pintar.** Entre los modulepreload de `dist/index.html` están `project`, `workforce`, `notifications` (17 kB), el store de catálogo con las ~2.300 líneas de catálogos semilla y `offlineStateCache`.

- **Propuesta.**
  1. Cargar los datos semilla con `import()` (T4).
  2. Importar `workforce` y `project` de forma diferida desde `session.ts`, restaurando su snapshot solo al entrar en sus rutas.
  3. Revisar el chunk `ui`: separar `i18next` (o retirarlo, §9) y evitar que el barrel `@/shared/ui` arrastre `EditableRow` y `SwipeActions` a rutas que no los usan.

  Objetivo orientativo: ≤ 220 kB gzip iniciales. Medir con `vite build` y Lighthouse móvil.

**R2 · Baja · Fuentes sin precarga.** `index.html` no hace `<link rel="preload">` de `manrope-latin-wght-normal.woff2`. Con `font-display: swap` se produce un cambio de fuente visible en el primer pintado.

- **Propuesta.** Precargar solo Manrope.

**R3 · Baja · `firebase/functions` va en la carga inicial.** `src/shared/firebase/config.ts:4` lo importa de forma estática, aunque solo lo usan el estimador y las notificaciones.

- **Propuesta.** Obtener `getFunctions` de forma diferida en `entities/notifications/api/functions.ts` y `entities/quote-estimator/api/firestore.ts`.

**R4 · Baja · DOM completo en los detalles.** Ya está documentado en `docs/performance.md`. Se mantiene la recomendación de medir antes de virtualizar.

---

## 9. Accesibilidad

**Lo que funciona.**

- `Modal` usa `<dialog>` nativo con trampa de foco, restitución y Escape.
- Hay skip link (`AppShell.tsx:111`) y `aria-current` en la navegación.
- 140 `aria-label`, 26 `role="status"` y 32 `role="alert"`.
- Ningún `div` con `onClick` sin rol.
- Se respeta `prefers-reduced-motion` en CSS y en JS.
- `font-size: 16px` en iOS evita el zoom al enfocar campos.

**X1 · Media · Contraste insuficiente.** Ratios calculados con WCAG 2.1:

- `text-gray-400` (`#8c9389`) da 3,11:1 sobre papel y 2,82:1 sobre cal. Hay 28 usos, varios en texto: `BudgetEditor.tsx:95,151`, `AddWorkItemButton.tsx:98`.
- `gray-500` sobre cal da 4,31:1.
- Terracota `#c65d3b` como texto, o blanco sobre terracota, da 4,11:1.
- `#b7694d` da 4,02:1.

Combinado con 142 usos de `text-xs`, `text-[10px]` y `text-[11px]`, el texto secundario no cumple AA (4,5:1).

- **Propuesta.** Tokens `ink-muted` ≥ 4,5:1 (`#52625a` da 5,77:1) y reservar `gray-400` para iconos decorativos y bordes. Prohibir textos por debajo de 12 px.

**X2 · Media · Formularios sin semántica de error.** Hay 0 `aria-invalid` y 1 `aria-describedby`. Los mensajes `field-error` usan `role="alert"`, pero no están asociados al campo. `Input` solo enlaza el label si el llamador pasa `id`.

- **Propuesta.** Resolverlo con el componente `Field` (§3).

**X3 · Media · Nombre accesible de los diálogos.** `Modal.tsx:47` usa `aria-label={title}` con el valor por defecto `'Ventana de diálogo'` (`:17`). Cuatro de los 17 usos no pasan `title` (13 sí). El nombre puede diferir del encabezado visible.

- **Propuesta.** Hacer `title` obligatorio o usar `aria-labelledby` apuntando al `<h2>` que pinte un `ModalHeader`.

**X4 · Baja · Botones simulados.** Los tres `div role="button"` (`BudgetEditor.tsx:177`, `BudgetHeader.tsx:68`, `BudgetDetailPage.tsx:461`) reimplementan Enter y Espacio. El de `BudgetEditor` tiene un área de `p-0.5` (unos 20 px), por debajo del mínimo de 24 px de WCAG 2.2.

- **Propuesta.** Usar `<button>` dentro de `CollapsibleSection`.

**X5 · Baja · Popovers con rol `dialog`.** `SwipeActions.tsx:166` usa `popover` con `role="dialog"` para un menú de acciones.

- **Propuesta.** Usar `role="menu"` con `menuitem` y navegación con flechas, o una lista de botones sin rol de diálogo.

**X6 · Baja · Sin verificación automática.** `tests/e2e/app.spec.ts` no ejecuta axe ni comprueba el orden de foco.

---

## 10. i18n

**I1 · Media · Adopción parcial y sin decisión.**

- **Evidencia.**
  - `src/shared/i18n/index.ts` inicializa i18next de forma síncrona con un único idioma y exporta un `t` no reactivo.
  - Solo 23 de 80 TSX lo importan, con 224 llamadas a `t()`.
  - Hay unas 700 cadenas literales en JSX y props. Los ficheros con más: `QuoteEstimatorSettingsPage` (66), `WorkforcePage` (61), `ProjectDetailPage` (53), `CatalogDetailPage` (51), `BudgetsPage` (42), `QuoteEstimatorPage` (38), `AppShell` (32).
  - Todas las features posteriores a BG-005 (proyectos, equipo, solicitudes, notificaciones) están sin extraer.
  - `translation.json` tiene 267 claves, de las que **94 no se usan**.
- **Por qué importa.** El coste de i18next (en el chunk inicial) no aporta nada hoy, y la mezcla dificulta revisar el tono de los textos (`docs/design-proposal.md`).
- **Propuesta.** Decidirlo con producto:
  - **(a) Solo español a medio plazo.** Retirar i18next y usar diccionarios tipados por feature (`pages/workforce/copy.ts`), lo que da comprobación de claves con TypeScript y 0 kB de runtime.
  - **(b) Multilenguaje previsto.** Adoptar `react-i18next` (dependencia nueva que requiere aprobación), namespaces por feature y una regla de lint que prohíba literales en JSX.

  En ambos casos, borrar las 94 claves muertas y llevar los formateadores de §3 a `Intl` con locale centralizado.

---

## 11. Calidad, tests y CI

**C1 · Alta · CI rota.** `.github/workflows/ci.yml:22` ejecuta `pnpm install` solo en la raíz (no hay `pnpm-workspace.yaml`), así que `functions/` queda sin dependencias. Tres suites de `tests/` importan `functions/src/notifications/*` y fallan con `ERR_MODULE_NOT_FOUND`. `main` lleva al menos 6 ejecuciones en rojo, y los pasos `test:integration` y `build` no se ejecutan.

- **Propuesta.**
  - Opción 1: añadir `pnpm --dir functions install --frozen-lockfile` antes de `pnpm test`.
  - Opción 2: mover esas tres suites a `functions/` con su propio `vitest`.
  - Añadir `pnpm format:check` y un paso de presupuesto de tamaño del bundle.

**C2 · Media · Adaptadores Firestore sin validación.** Según el AST hay 110 `as`, la mayoría `snapshot.data() as X`, concentrados en `entities/project/api/firestore.ts` (28), `entities/workforce/api/firestore.ts` (9) y `entities/catalog/api/firestore.ts` (5). Hay 65 aserciones no nulas `!`, por ejemplo `WorkforcePage.tsx:41-43,287`.

- **Propuesta.** Usar `withConverter` por colección con guardas manuales (`isProjectDoc`) en `model/`, sin dependencia nueva. Errores tipados con `FirebaseError.code`.

**C3 · Media · ESLint mínimo.** `eslint.config.js` solo extiende `recommended`, `react-hooks` y `react-refresh`, con `ecmaVersion: 2020` aunque el target es ES2023. Faltan:

- Reglas con tipos (`recommendedTypeChecked`), en particular `no-floating-promises` y `no-misused-promises`. Hay 54 `void promesa()` y 10 `.catch(() => {})` silenciosos.
- `no-restricted-imports` para FSD (A1) y para los hex arbitrarios (E1).
- Un plugin de accesibilidad: `eslint-plugin-jsx-a11y` (dependencia nueva que requiere aprobación).

**C4 · Media · No hay tests de componentes ni de accesibilidad.**

- `vitest.config.ts` usa `environment: 'node'`. Los 46 ficheros prueban modelos, stores y utilidades, que es una cobertura buena de dominio.
- No hay ninguna prueba de `shared/ui` (Modal, Field, SwipeActions) más allá de `tests/button.test.ts`, que es de lógica.
- No hay umbral de cobertura.
- E2E: 48 tests en 2 ficheros; `tests/e2e/app.spec.ts` tiene 3.253 líneas, `workers: 1` y `retries: 0`.
- **Propuesta.**
  1. Dividir `app.spec.ts` por flujo (`budgets`, `projects`, `team`, `catalog`, `pwa`) con fixtures compartidas.
  2. Añadir comprobaciones axe en las 8 pantallas principales.
  3. Tests de componentes con `jsdom` y Testing Library, que son dependencias nuevas a proponer.
  4. Activar `vitest --coverage` con un umbral inicial realista (60 % en `entities/*/model` y `shared/lib`).

**C5 · Baja · Errores silenciosos y sin observabilidad.** Hay 56 `catch {}` vacíos (muchos justificados: modo privado o almacenamiento bloqueado). Solo hay 3 `console.*` y ningún reporte de errores ni de Web Vitals en producción. `errorElement` existe en el router, pero no se registra nada.

- **Propuesta.** Un `reportError` mínimo en `shared/lib` (con Firebase Performance o un endpoint de Functions) y `web-vitals`, previa aprobación.

**C6 · Baja · Redirecciones inconsistentes.** `/` redirige a `/projects` (`router.tsx:27`), pero `*` redirige a `/budgets` (`router.tsx:127`).

---

## 12. Plan de mejora por fases

Las estimaciones son para una persona con contexto del proyecto e incluyen sus tests y su verificación. Cada bloque es una PR independiente, como pide `AGENTS.md`.

### Fase 0 · Quick wins (< 1 día cada uno, ~4–5 días en total)

| #   | Tarea                                                                                                                                | Estimación | Cierra             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------ |
| 1   | Reparar la CI: instalar `functions/` o mover sus suites; añadir `format:check`                                                       | 1–2 h      | C1                 |
| 2   | Stubs de `html2canvas`, `dompurify` y `canvg` más la exclusión de assets en `build-sw.mjs`; verificar el PDF                         | 3–4 h      | P1, R1 (parcial)   |
| 3   | `shared/lib/format.ts` y `dateKey.ts`; sustituir las ≥10 copias                                                                      | 3 h        | §3, T3             |
| 4   | `toUserMessage(error)` por `FirebaseError.code`; sustituir las 3 copias y los 10 `e.message`                                         | 3 h        | T3                 |
| 5   | `calculateWorkItemProgress` en la entidad; usarla en `ProjectDetailPage`                                                             | 2 h        | T3                 |
| 6   | `Modal`: `title` obligatorio y `aria-labelledby`; `CollapsibleSection` que sustituya los 3 `role="button"`                           | 3 h        | X3, X4             |
| 7   | Contraste: retirar `text-gray-400` del texto y subir los textos de 10–11 px                                                          | 3 h        | X1                 |
| 8   | Exportar los internos desde los `index.ts`, añadir `no-restricted-imports` y mover `ProjectProgressBar` a `entities/project/ui`      | 2 h        | A1, A2             |
| 9   | Debounce del snapshot offline por clave y vaciado en `pagehide`                                                                      | 3 h        | S1                 |
| 10  | Borrar las 14 clases CSS muertas y las 94 claves i18n sin uso; unificar la redirección `*`; precargar Manrope; `color-scheme: light` | 2 h        | E2, I1, C6, R2, E6 |

### Fase 1 · Medio plazo (3–5 semanas)

| Bloque                          | Contenido                                                                                                                                                                                                     | Estimación |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Tokens de diseño                | Tokens semánticos de color, tipografía, radio, sombra, `z-index` y breakpoint `shell` en `@theme`; codemod de los 436 hex en TSX y 218 en CSS; regla que prohíba hex nuevos. Spec en `docs/specs/`            | 4–5 días   |
| CSS por capas                   | `index.css` dividido en `tokens/base/shell/print/motion` y CSS por feature dentro de `@layer components`; eliminar los `!important` por especificidad y los `!` de Tailwind                                   | 3–4 días   |
| Primitivas                      | `Button` con `size`, `IconButton`, `Field`, `Textarea`, `Checkbox`, `Alert`, `EmptyState`, `Badge`, `Card` con variantes, `Modal` con tamaños y `sheet`, toast unificado; migración de los usos citados en §3 | 5–6 días   |
| Partición de páginas            | `WorkforcePage` en 3 rutas; `useWeekSwipe` y subcomponentes del calendario; `ProjectDetailPage` (secciones de ampliaciones, metadatos y capítulos); `CatalogEditor` (importador); wizard del estimador        | 6–8 días   |
| `useRouteResource`              | Hook común y migración de las 7 páginas                                                                                                                                                                       | 2 días     |
| Carga inicial                   | Datos semilla bajo demanda; `workforce` y `project` diferidos en la sesión; `firebase/functions` diferido; revisar el barrel `shared/ui`. Objetivo ≤ 220 kB gzip                                              | 2–3 días   |
| Validación de datos             | `withConverter` y guardas por colección; reducir los `as` a < 20                                                                                                                                              | 3–4 días   |
| Decisión e implantación de i18n | Opción (a) o (b) de §10, con extracción de las ~700 cadenas                                                                                                                                                   | 3–6 días   |
| iOS y manifest                  | Splash screens, `mobile-web-app-capable`, `screenshots` y revisión de `orientation`; verificación en dispositivo                                                                                              | 1–2 días   |

### Fase 2 · Largo plazo (1–2 meses, según prioridad de producto)

- **Tests.** Dividir `app.spec.ts` por flujo, axe en las pantallas principales, tests de componentes en `jsdom` (dependencia a aprobar), cobertura con umbral y regresión visual de `shared/ui` en 320, 390 y 1440 px. **2–3 semanas.**
- **ESLint con tipos y accesibilidad.** `recommendedTypeChecked`, `no-floating-promises` y `jsx-a11y`, corrigiendo los hallazgos. **1 semana.**
- **Dominio fuera de `shared`.** Tipos de presupuesto y catálogo en sus entidades, PDF como `features/budget-export` y contratos compartidos con Functions en `shared/contracts`. **1 semana.**
- **API de proyecto por agregados.** Partir `entities/project/api/firestore.ts` manteniendo la fachada y los tests de reglas. **1 semana.**
- **Observabilidad.** Reporte de errores y Web Vitals en producción. **2–3 días.**
- **Modo oscuro.** Solo si producto lo pide; con los tokens semánticos supone redefinir variables. **3–4 días.**
- **Escalabilidad de datos.** Paginación remota de presupuestos y virtualización de detalles, solo tras medir con documentos representativos (`docs/performance.md`). **1–2 semanas.**

### Riesgos y orden recomendado

1. Arreglar primero la CI (Fase 0 #1): sin ella no hay red de seguridad para el resto.
2. Los tokens y las capas de CSS cambian el aspecto de forma global. Hacerlos con capturas antes y después de las pantallas de `tests/e2e` en 320, 390 y 1440 px, y en PRs separadas de las de primitivas.
3. Partir `WorkforcePage` en rutas toca el contrato de conservar semana y filtro (`docs/state-and-cache.md`, BG-011). Requiere actualizar ese documento y ampliar los E2E del calendario.
4. Retirar o adoptar i18next, añadir dependencias de test y lint o eliminar `logo.png`/`icons.svg` son decisiones a proponer, no a ejecutar de forma unilateral (`AGENTS.md`).

## Anexo. Revisión en navegador de producción (11-11-2026)

Revisión de `https://budgenerator.web.app` sin sesión iniciada, a 1440 px y a 375 px. No se guardó ni se modificó nada. Las pantallas autenticadas quedan pendientes de una sesión del propietario.

- **No hay landing pública.** `/` redirige a `/projects` y de ahí a `/login`. En escritorio, el panel izquierdo del login solo muestra el nombre, sin propuesta de valor. Es un bloqueo para cualquier captación de pago (ver [viabilidad de mercado](market-viability-meta-ads.md)).
- **Registro sin textos legales.** No hay enlaces a privacidad, condiciones ni aviso legal, ni casilla de aceptación. La contraseña mínima es de 6 caracteres.
- **El login descarga casi toda la app.** Hace 44 peticiones JS con unos 913 KB descomprimidos y 281 KB transferidos, entre ellas `firebase-firestore` (262 KB), `ui` (197 KB), `react-core` (185 KB) y los stores de proyecto, equipo y notificaciones. Los iconos de lucide llegan en decenas de chunks de menos de 1 KB. Esto confirma el hallazgo de carga inicial de la sección 8: la ruta pública debería cargar solo Auth y el formulario.
- **En registro, el botón deshabilitado tiene poco contraste** (verde grisáceo sobre crema), lo que es coherente con la sección 9.
- **Lo positivo:** no hay errores en consola. `lang="es"`, el manifest, el service worker activo y `og:title` están presentes. La identidad visual (Fraunces + Manrope, botones píldora) es coherente entre escritorio y móvil.

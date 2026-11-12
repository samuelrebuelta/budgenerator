# Análisis de la arquitectura IA — BudGenerator

Fecha: 11-11-2026. Rama analizada: `claude/project-analysis-improvement-914b89` (`59d00d2`, igual que `main` local). Alcance: (A) cómo se guía a los agentes de código (Claude Code, Codex) en el repositorio y (B) la IA dentro del producto (BG-006, retirada). Solo lectura salvo este informe.

Método: lectura de `AGENTS.md`, `.github/AGENTS.md`, `.impeccable/config.json`, `docs/` completo (tamaños y cabeceras de todos los ficheros, lectura íntegra de los operativos y de BG-006), `.github/workflows/ci.yml`, `package.json`, `functions/`, `scripts/ai-baseline/`, `tests/aiBaseline.test.ts`; del checkout principal, `CLAUDE.md` y `git diff` de `AGENTS.md` (sin modificar nada); historial de GitHub Actions (`gh run list`, `gh run view --log-failed`). Las estimaciones de tokens usan ~3,6 caracteres por token (español con Markdown); son aproximadas.

---

## 1. Resumen ejecutivo

El repositorio tiene una arquitectura de contexto **pensada y por encima de la media**: un `AGENTS.md` corto con tabla de enrutado por tipo de tarea, un plan vigente de 20 líneas separado del histórico y documentos temáticos estables. El coste de arranque es bajo (~1,6 K tokens). Los problemas están **detrás del enrutado**: documentos de contrato que crecen como changelog por entrega (párrafos de hasta 2.200 caracteres), dos sistemas de specs sin índice ni estados fiables, documentos históricos sin marcar como tales en el enrutado, y sobre todo **una red de verificación que no verifica**: la CI de `main` lleva **9 ejecuciones seguidas en rojo desde el 18-10-2026** y el histórico registra despliegues a producción con "fallos ajenos conocidos". La IA del producto (BG-006) está bien archivada; quedan un evaluador offline y su test como residuo inocuo pero sin dueño.

### Nota por dimensión (0-10)

| Dimensión                                               | Nota  | Justificación breve                                                                                                                                                          |
| ------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enrutado de contexto (`AGENTS.md` → docs)               | **8** | Tabla por tipo de tarea, plan corto, lectura incremental. Falta enrutar specs/plans y marcar lo histórico.                                                                   |
| Coste en tokens por defecto                             | **8** | ~1,6 K tokens de arranque. Penaliza el coste _al seguir una fila_ (firebase.md ~9 K, styles ~6 K) por párrafos-changelog.                                                    |
| Duplicación y deriva entre documentos                   | **4** | `.github/AGENTS.md` duplica y diverge; README, testing.md, BG-006, BG-007 y architecture.md con datos obsoletos verificados.                                                 |
| Flujo spec-driven (spec → plan → ejecución → evidencia) | **5** | Hay specs, plans y evidencias reales, pero dos carpetas con convenciones distintas, estados no fiables y sin índice.                                                         |
| Compatibilidad Claude Code / Codex                      | **5** | `AGENTS.md` sirve a ambos; `CLAUDE.md` existe solo sin versionar en el checkout principal; skills referenciadas son personales; ningún `.claude/` de proyecto.               |
| Guardarraíles automáticos (CI, hooks, permisos)         | **3** | CI correcta en diseño pero rota desde hace 3 semanas; sin hooks ni permisos de proyecto; despliegue manual sin puerta de CI.                                                 |
| Escalabilidad a una app nativa / ecosistema             | **5** | La regla "monorepo requiere spec" es sana, pero el contexto es monolítico web y no hay contratos compartidos extraíbles.                                                     |
| IA en producto (diseño BG-006)                          | **8** | Diseño sobresaliente en seguridad (catálogo cerrado, sin `cost` al modelo, cálculo determinista). Obsoleto en supuestos (sin Functions, OpenAI, modelo de catálogo antiguo). |
| Residuo IA en código                                    | **7** | Ningún runtime de IA en `src/` ni `functions/`. Quedan `scripts/ai-baseline/`, corpus y un test que corren en cada `pnpm test`.                                              |

**Nota global: 6/10.** El diseño del contexto es bueno; la disciplina de mantenimiento y la verificación automática son el cuello de botella.

### Top 10 mejoras (por impacto/esfuerzo)

1. **Reparar la CI** (instalar dependencias de `functions/` antes de `pnpm test`) y no desplegar con CI en rojo. → H-01.
2. **Versionar un `CLAUDE.md` mínimo que importe `AGENTS.md`** y consolidar `.github/AGENTS.md` dentro de `AGENTS.md` (ya hay un borrador sin commitear en el checkout principal). → H-03, H-04.
3. **Añadir `.claude/settings.json` de proyecto** con permisos `deny` para deploy/push/lecturas de secretos y un hook que ejecute lint/typecheck de los ficheros tocados. → H-02, §5.3.
4. **Unificar specs y plans en un único árbol con índice y estado** (`docs/specs/README.md` con tabla ID → spec → plan → estado → evidencia). → H-06.
5. **Separar contrato de bitácora**: sacar los párrafos "BG-0xx (fecha): verificado…, desplegado…" de `testing.md`, `firebase.md`, `architecture.md` y `styles-and-responsive.md` a las specs o al histórico. → H-07.
6. **Archivar explícitamente lo histórico** (`project-analysis.md`, `sdd-plan.md`, `stability-and-release.md`, `design-proposal.md`, BG-002/006/007) en `docs/archive/` y añadir en `AGENTS.md` "no leer salvo trazabilidad". → H-05.
7. **Corregir las derivas verificadas** (README stack/estructura, `testing.md` emuladores y rutas, BG-007 estado, `architecture.md` fecha). → H-08.
8. **Retirar la instrucción de probar producción "desde Codex" con la cuenta admin** o encerrarla en un procedimiento de solo lectura con confirmación. → H-09.
9. **Skills y subagentes de proyecto versionados** (`verify`, `spec-new`, `rules-change`, `doc-sync`; subagentes `firebase-rules-reviewer`, `doc-drift-auditor`) en `.agents/skills` / `.claude/`. → §5.
10. **Decidir el residuo BG-006**: mover `scripts/ai-baseline` + corpus + test a `docs/archive/BG-006/` o mantenerlos explícitamente como "evaluador listo para reanudar". → H-12.

---

## 2. Mapa actual del sistema de contexto

```text
Arranque (lo que el agente recibe sin pedirlo)
├── ~/.claude/CLAUDE.md + RTK.md        (personal; reparto de modelos, rtk)
├── AGENTS.md (raíz, 31 líneas, ~1,1 K tok)    ← Codex lo lee siempre; Claude Code en esta sesión también
└── CLAUDE.md                                  ← solo en el checkout principal, SIN VERSIONAR (`@AGENTS.md`)

Primer salto obligatorio
└── docs/plan.md (20 líneas, ~0,5 K tok)  → enlaza docs/plan-history.md (266 líneas, ~22 K tok)

Enrutado por fila (AGENTS.md:9-17)
├── styles-and-responsive.md  ~6,2 K tok (línea máx. 2.222 car.)
├── product.md                ~2,3 K tok (formato impeccable)
├── architecture.md           ~4,3 K tok
├── firebase.md               ~9,0 K tok
├── state-and-cache.md        ~3,4 K tok
├── performance.md / pdf-export.md  (cortos)
└── testing.md                ~1,9 K tok (mezcla procedimiento + bitácora)

No enrutado, pero enlazado desde otros docs
├── project-analysis.md (~15 K tok, auditoría del 04-10)  ← enlazado desde testing.md:76 y README
├── sdd-plan.md, stability-and-release.md, design-proposal.md
├── docs/specs/            BG-002, BG-006 (×3), BG-007 (×2), BG-008, BG-012
├── docs/superpowers/specs/  13 diseños con fecha (BG-004/005/009/010/011, catálogo, BC3)
├── docs/superpowers/plans/  17 planes de implementación con checkboxes
└── docs/testing-evidence/   63 PNG + 2 JPG (7,1 MB) + ai-baseline/corpus.v1.json

Fuera del repo (no portables)
├── ~/.claude/skills/context-aware-pr-review, project-context-setup   (citada en AGENTS.md:19)
├── ~/.agents/skills/superpowers, impeccable, frontend-design…       (generan docs/superpowers y product.md)
└── ~/.claude/settings.json  hook PreToolUse rtk-rewrite               (único hook activo)

Verificación automática
└── .github/workflows/ci.yml   lint → test → playwright → test:integration → build   (ROJA desde 18-10)
```

**Coste de lectura típico**

- Arranque: AGENTS.md + plan.md ≈ **1,6 K tokens** (excelente).
- Tarea de datos/permisos: + firebase.md + `firestore.rules` (36 KB ≈ 10 K) + servicio ≈ **20-25 K**.
- Si el agente sigue el enlace "histórico" por curiosidad: + plan-history ≈ **+22 K**; si sigue `testing.md:76` → project-analysis ≈ **+15 K**. Ninguno de los dos aporta a una tarea corriente.

---

## 3. Hallazgos — A) Arquitectura de contexto para agentes

Severidad: **Crítica** (rompe la verificación o la seguridad), **Alta** (induce errores probables), **Media** (coste o deriva acumulativa), **Baja** (higiene).

### H-01 · Crítica · La CI de `main` está rota desde el 18-10-2026 y el flujo la ignora

**Evidencia**

- `gh run list`: las 9 últimas ejecuciones de "Validate budgenerator" en `main` fallan (18-10 → 08-11); la última verde es del 17-10-2026.
- Log de la ejecución `42537388482`: `tests/fcmDelivery.test.ts`, `tests/leadNotificationJobs.test.ts` y `tests/notificationPreferences.test.ts` fallan con `Cannot find package 'firebase-admin/messaging' | 'firebase-admin/app' | 'firebase-functions/v2/https'`. Los 209 tests restantes pasan.
- Causa: `functions/` es un paquete independiente con su propio `pnpm-lock.yaml` (`functions/package.json`), no hay `pnpm-workspace.yaml` en la raíz y `ci.yml:23` solo ejecuta `pnpm install --frozen-lockfile` en la raíz. En local pasa porque `functions/node_modules` existe.
- Al fallar `pnpm test` (`ci.yml:25`), **nunca se ejecutan** `test:integration` (reglas + E2E) ni `build` en CI.
- El histórico normaliza la desviación: `docs/plan-history.md:29`, `:31`, `:35` registran `pnpm test` 194/195 y 206/207 "por la expectativa ajena desactualizada" **y a continuación "Desplegado… en https://budgenerator.web.app"**. `docs/plan-history.md:9`: "La ejecución completa de E2E… reportó 33/48… no se repitió la suite completa".
- `AGENTS.md:30` exige `pnpm lint`, `pnpm build` y tests para cerrar, pero ninguna regla vincula despliegue con CI verde.

**Impacto**: los agentes registran verificaciones locales que la CI no puede reproducir; el único guardarraíl independiente no protege nada desde hace tres semanas, justo cuando entraron BG-010/011/012 (reglas de Firestore y Functions).

**Propuesta**

```yaml
# .github/workflows/ci.yml (tras pnpm install)
- run: pnpm --dir functions install --frozen-lockfile
```

o declarar el workspace (`pnpm-workspace.yaml` con `packages: ['functions']`) si se acepta unificar lockfiles (decisión del usuario, cambia `functions/pnpm-lock.yaml`). Añadir a `AGENTS.md` (sección de verificación): "No se despliega con la CI de `main` en rojo. Un fallo 'conocido' se arregla o se marca `skip` con issue enlazada en el mismo PR; nunca se registra como aceptable". Opcional: `scripts/deploy.mjs` comprueba `gh run list --branch main -L1 --json conclusion` antes de desplegar.

### H-02 · Alta · No hay guardarraíles deterministas de proyecto para agentes

**Evidencia**: no existe `.claude/` versionado en el repo (el `.claude/` del checkout principal solo contiene `worktrees/`); el único hook es personal (`~/.claude/settings.json`, PreToolUse `rtk-rewrite.sh`). Las prohibiciones críticas (no deploy, no push, no tocar producción, no leer `docs/testing-access.local.md`) solo existen como prosa en `AGENTS.md:23,31` y `.github/AGENTS.md:12-14`. Los scripts `firebase:deploy` y `firebase:deploy:all` (`package.json:11,20`) están a un `pnpm` de distancia.

**Impacto**: un agente en modo automático solo está frenado por instrucciones en lenguaje natural; Codex y Claude Code no comparten ningún mecanismo ejecutable.

**Propuesta**: ver §5.3 (`.claude/settings.json` con `permissions.deny` y hooks `PostToolUse`/`Stop`). Para Codex, el equivalente es `.codex/config.toml` de proyecto con `approval_policy`/`sandbox_mode` y reglas de comandos, si la versión instalada lo soporta (verificar).

### H-03 · Alta · `CLAUDE.md` no está versionado; los worktrees de Claude dependen de que la herramienta lea `AGENTS.md`

**Evidencia**: el checkout principal tiene `CLAUDE.md` con una sola línea `@AGENTS.md`, pero `git status` lo muestra como `??` (sin seguimiento). Este worktree (`.claude/worktrees/…`) no lo contiene. En esta sesión el arnés inyectó `AGENTS.md` igualmente, pero la compatibilidad documentada y estable de Claude Code pasa por `CLAUDE.md`.

**Propuesta**: versionar `CLAUDE.md` (ver §5.1). Coste: 1 línea; elimina la dependencia de un comportamiento implícito y hace que cualquier worktree o clon nuevo cargue el mismo contexto.

### H-04 · Alta · `.github/AGENTS.md` duplica y diverge de `AGENTS.md`

**Evidencia**: `.github/AGENTS.md:1-14` repite stack, capas, comandos y prohibiciones con otro reparto: menciona `budgetMath.ts`, DTO público, contrato PWA y el deploy separado (`:6-10`, `:14`) que **no** están en `AGENTS.md`; omite `test:rules`/`test:e2e`. Codex solo carga `AGENTS.md` de la raíz hasta el directorio de trabajo, así que `.github/AGENTS.md` solo se aplica a quien trabaje dentro de `.github/`: las reglas más técnicas del proyecto están en el fichero que casi nadie carga.
En el checkout principal hay un cambio sin commitear que borra `.github/AGENTS.md` y fusiona su contenido en `AGENTS.md` (secciones "Arquitectura y convenciones", "Seguridad", "Ejecución y verificación"). Es la dirección correcta.

**Propuesta**: commitear esa fusión (revisándola) junto con `CLAUDE.md`, en un único PR de contexto. Mantener `AGENTS.md` ≤ ~60 líneas.

### H-05 · Media · Documentos históricos accesibles sin señal de "no leer"

**Evidencia**

- `docs/project-analysis.md` (55 KB, ~15 K tok): auditoría del 04-10 sobre `c065c02` que afirma "No hay… Cloud Functions" (línea 7); enlazada como referencia vigente desde `docs/testing.md:76` y desde el README.
- `docs/plan-history.md` (81 KB, ~22 K tok, líneas de hasta 1.391 car.), enlazado desde `docs/plan.md:3`.
- `docs/sdd-plan.md` (15-10), `docs/stability-and-release.md` (14/15-10), `docs/design-proposal.md` (14/15-10) siguen en la raíz de `docs/` junto a los contratos vigentes.

**Impacto**: un agente que "amplía la lectura cuando haya contradicciones" (`AGENTS.md:19`) encuentra justo las contradicciones que lo llevan a leer estos ficheros; 15-37 K tokens de contexto obsoleto con apariencia de autoridad.

**Propuesta**: mover a `docs/archive/` con cabecera uniforme `> Archivo histórico. No describe el estado actual.` y una línea en `AGENTS.md`: "`docs/archive/` solo para rastrear decisiones; nunca como fuente del comportamiento actual". Partir `plan-history.md` por trimestre o por tarea si sigue creciendo.

### H-06 · Media · Dos sistemas de specs sin índice ni estados fiables

**Evidencia**

- `AGENTS.md:19`: "añade la spec correspondiente en `docs/specs/` **o** `docs/superpowers/specs/`", sin criterio.
- `docs/specs/` usa IDs (`BG-002`, `BG-006`, `BG-007`, `BG-008`, `BG-012`); `docs/superpowers/specs/` usa fechas (`2026-10-17-bg-004-…-design.md`) y su pareja `docs/superpowers/plans/`. BG-012 tiene spec en `docs/specs/` y plans en `superpowers/plans/`; BG-005 tiene cuatro specs de diseño distintas.
- Estados: `docs/specs/BG-007-design-ux-consistency.md:2` dice "En revisión (implementación local)" mientras `docs/plan.md:9` lo da por integrado; 4 specs y 12 de 17 plans no tienen línea de estado; varios plans entregados mantienen casillas sin marcar (`2026-10-18-bg-010-notificaciones-solicitudes.md`: 2, `2026-11-06-bg011-fecha-fin-estimada.md`: 2, `2026-10-19-bc3-intercambio.md`: 51 sin marcar, coherente con "trabajo futuro").
- La carpeta `superpowers` nombra la herramienta que generó los documentos, no su función; un agente sin esa skill no sabe qué convención seguir.

**Propuesta**: estructura única e índice (ver §5.4). Migración mecánica con `git mv`, sin reescribir contenido; los enlaces internos se corrigen con un script y se validan con el comprobador de enlaces de §5.3.

### H-07 · Media · Los contratos técnicos crecen como bitácora por entrega

**Evidencia**

- `docs/testing.md:78-98`: secciones "BG-007 (16 de octubre)", "BG-008 (16 de octubre)", "BG-008: catálogo… (17 de octubre)" con conteos de tests y despliegues; `:72-74` "Estado de la última comprobación… 4 de octubre".
- `docs/architecture.md:37-75` y `docs/firebase.md:59-138` se organizan por ID de tarea (BG-005, BG-009, BG-010, BG-011, BG-012) en lugar de por módulo; `architecture.md:67` incluye "se publicaron… desde el worktree `codex/bg011-equipo-agenda` el 07-11-2026".
- Líneas de 1.500-2.200 caracteres (`styles-and-responsive.md`, `architecture.md`, `firebase.md`): dificultan `Edit` por cadena única, la revisión de diffs y la lectura parcial por rango.

**Impacto**: cada entrega añade texto que nadie poda; el coste de "seguir una fila" crece linealmente con el número de tareas, y lo vigente se mezcla con lo que fue cierto un día.

**Propuesta**: regla en `AGENTS.md`: "Los documentos de `docs/` describen el estado actual por módulo. Fechas, conteos de tests y despliegues van a la spec/plan de la tarea o a `plan-history.md`". Reformatear a una frase por línea o párrafos ≤ 400 caracteres al tocar cada documento (sin PR de reescritura masiva).

### H-08 · Media · Derivas verificadas contra el código

| Documento                                      | Afirmación                                                  | Realidad                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `README.md:21`                                 | Firebase "Auth, Firestore y Hosting"                        | También Cloud Functions (`functions/src/index.ts`, estimador y avisos).                 |
| `README.md:78`                                 | `entities/`: auth, budget, catalog, template, profile, user | Además `project`, `workforce`, `quote-estimator`, `notifications` (`src/entities/`).    |
| `README.md:16`                                 | "tres creaciones acumuladas"                                | `docs/product.md:39`: 3 plazas compartidas entre presupuestos y proyectos.              |
| `docs/testing.md:18`                           | "La configuración actual no conecta emuladores"             | `src/shared/firebase/config.ts:21` conecta si `VITE_USE_FIREBASE_EMULATORS === 'true'`. |
| `docs/testing.md:61`                           | Ruta `/catalogs`                                            | Ruta vigente `/catalog`; `/catalogs` es redirección (`docs/architecture.md:17`).        |
| `docs/firebase.md:3`                           | Functions "para el estimador público"                       | También avisos BG-010 (`functions/src/notifications/`).                                 |
| `docs/architecture.md:3`                       | "Actualizado el 18 de octubre"                              | Contiene BG-011/012 de noviembre.                                                       |
| `docs/specs/BG-006-ai-budget-generation.md:17` | "NO hay Functions"                                          | Hay Functions desplegadas en `europe-west1`.                                            |
| `docs/specs/BG-007-design-ux-consistency.md:2` | "En revisión"                                               | Integrado (`docs/plan.md:9`).                                                           |

**Propuesta**: corregir en un PR de documentación; añadir el subagente `doc-drift-auditor` (§5.2) a la rutina de cierre de cada tarea, limitado a los documentos que enruta la fila afectada.

### H-09 · Media · Instrucción de verificar producción con la cuenta admin

**Evidencia**: `docs/testing.md:5` publica el email de la cuenta admin de producción; `:55` "iniciar sesión con la cuenta de pruebas permite verificar la aplicación desde Codex"; `:68` advierte que editar modifica datos reales. La contraseña está en `docs/testing-access.local.md` (ignorado, `.gitignore:17`).

**Impacto**: invita a un agente a autenticarse en producción con privilegios de administración, en contradicción con "No modificar datos reales o producción en pruebas" (`AGENTS.md:23`). Riesgo de acciones irreversibles por un clic de agente.

**Propuesta**: sustituir por "La verificación de producción la hace una persona. Un agente solo lee rutas públicas o usa emuladores `demo-`". Añadir `Read(./docs/testing-access.local.md)` a `permissions.deny` (§5.3).

### H-10 · Media · Dependencias de skills personales no versionadas

**Evidencia**: `AGENTS.md:19` cita `context-aware-pr-review` (solo en `~/.claude/skills/`); `docs/product.md:3` lleva el marcador `<!-- impeccable:product-schema 1 -->` y encabezados en inglés impuestos por la skill `impeccable` (`~/.agents/skills/impeccable`), en conflicto leve con "Documentación… en español" (`AGENTS.md:24`); `docs/superpowers/` deriva de la skill `superpowers`. `.impeccable/config.json` sí está versionado.

**Propuesta**: aceptar las skills personales como opcionales ("si está disponible" ya lo dice), pero versionar en el repo las que codifican **procesos del proyecto** (§5.2), en `.agents/skills/` (convención compartida) con enlace o copia en `.claude/skills/` para Claude Code. Documentar en `AGENTS.md` qué genera cada carpeta.

### H-11 · Baja · Evidencias binarias pesadas en `docs/`

**Evidencia**: `docs/testing-evidence/` = 7,1 MB de 7,8 MB de `docs/` (65 imágenes), sin índice; capturas de BG-007 de octubre conviven con BG-011.

**Propuesta**: carpeta por tarea (`docs/specs/BG-011/evidence/`) o artefactos de CI; nunca enlazarlas desde documentos enrutados para que un agente no las abra (las imágenes cuestan tokens de visión).

---

## 4. Hallazgos — B) IA dentro del producto

### Estado

- `docs/plan.md:16`: "BG-006. Generación con IA retirada del roadmap. El asistente es el flujo vigente de creación guiada."
- `docs/product.md:38`: precios y partidas con reglas deterministas; IA fuera del roadmap. `docs/product.md:36-37` y `docs/superpowers/specs/2026-10-17-bg-005-landings-y-solicitudes-design.md:5,14,22` conservan una **segunda** idea de IA (textos de landing por empresa) como visión no autorizada.
- Specs: `docs/specs/BG-006-ai-budget-generation.md` (archivada, `:2-3`), `BG-006-baseline.md` (ADRs y límites), `BG-006-contracts.md` (contratos v1).

### H-12 · Baja · Residuo de BG-006 en el código

**Evidencia**: búsqueda de `openai|anthropic|llm|BG-006|budget-assistant` en `src/`, `functions/src/`, `firestore.rules`, `firebase.json` y `package.json`: **sin coincidencias**. Ningún runtime, dependencia, secreto ni endpoint de IA. Residuo:

- `scripts/ai-baseline/evaluate.mjs` y `report.mjs` (evaluador offline de propuestas guardadas; no llama a proveedores, `evaluate.mjs:1`).
- `docs/testing-evidence/ai-baseline/corpus.v1.json` (13 casos sintéticos).
- `tests/aiBaseline.test.ts`, que se ejecuta en cada `pnpm test` (incluido por `vitest.config.ts`, `include: tests/**/*.test.ts`).
- `docs/architecture.md:49` menciona "el prototipo local de BG-006"; `features/budget-assistant` citado en `BG-006-baseline.md` (ADR 2) no existe en `main`.

**Propuesta**: si no se retoma en el trimestre, mover evaluador, corpus y test a `docs/archive/BG-006/` (fuera de `vitest`); si se quiere conservar como activo para el futuro, dejarlo pero declararlo en el índice de specs como "evaluador listo, sin runtime". Decisión del usuario; no se elimina nada sin propuesta (regla `AGENTS.md:25`).

### H-13 · Media (si se retoma) · El diseño de BG-006 es sólido pero sus supuestos han caducado

**Lo que está bien y debe conservarse** (`BG-006-ai-budget-generation.md:21-33`, `BG-006-contracts.md`):

- Clave solo en servidor, nunca `VITE_*` ni tokens de sesión de terceros (`:22-23`).
- El modelo **elige** entre candidatos con IDs efímeros; el servidor **hidrata** descripción, unidad y precio desde el catálogo real; `cost` nunca sale (`:26`, `:69`).
- Importes calculados solo por `budgetMath` (`:30`); cantidades desconocidas como `null` + revisión (`:28`).
- Resultado = borrador en el editor; nada se guarda hasta `saveDraft` y cuota (`:29`, `:95`).
- UID del token, no del body; minimización de PII; sin prompts en logs (`:31`).
- Límites técnicos explícitos y techo de coste por solicitud calculado antes de llamar (`BG-006-baseline.md`, ADR 4).
- Evaluador determinista que rechaza referencias ajenas, campos no contratados y cantidades inválidas.

**Lo que ha caducado**

- `:17` "no hay Functions ni billing": hoy hay Functions v2 en `europe-west1` con `maxInstances` (`functions/src/quoteEstimator.ts:44,549`), así que la infraestructura base ya existe.
- `:12-13` modelo `Tariff`/`TariffCatalog` plano: el catálogo es ahora único (`tariffCatalogs/main-v1`) con `parts[]` (capítulos) y `concepts[]` (partidas) (`docs/architecture.md:53`). Los contratos deben referirse a capítulos/partidas.
- `:22` proveedor OpenAI y "verificar modelo y tarifas": hay que reescribir la selección de proveedor.
- El flujo guiado BG-008 (`features/budget-structure`, `appendStructure(items, expected)`) ya resuelve la inserción atómica que BG-006.5 pedía diseñar: es el punto de integración natural.
- No hay App Check en ninguna Function (`grep appCheck` = 0 en `src/` y `functions/src/`). Para el estimador público es tolerable; para un endpoint con coste por llamada no.

### 4.1 Arquitectura recomendada si se retoma

**Principio**: IA como _selector_ sobre un espacio cerrado, no como _generador_ de presupuestos. El valor es pasar de texto libre ("reforma de baño de 6 m², cambiar plato por ducha, alicatar") a una selección de partidas del catálogo que el asistente BG-008 ya sabe insertar.

```text
Cliente (PWA)                          Cloud Function (europe-west1)                  Anthropic API
─────────────                          ─────────────────────────────                  ─────────────
features/budget-structure
  └─ "Describir trabajo" (texto)
       │ callable proposeBudgetStructure
       │ {requestId, text, schemaVersion}   enforceAppCheck: true
       │                                    uid ← request.auth (nunca del body)
       │                                    reserva cuota diaria (transacción)
       │                                    lee users/{uid}/tariffCatalogs/main-v1
       │                                    redacta PII (email/teléfono/DNI)
       │                                    recuperación léxica → ≤30 candidatos
       │                                    {cid, capítulo, partida, unidad}
       │                                    (sin precio ni coste: el modelo no los necesita)
       │                                        ──────────────────────────────────►  messages.parse
       │                                                                            output_config.format
       │                                                                            (JSON Schema/Zod)
       │                                        ◄──────────────────────────────────  {lines,questions,warnings}
       │                                    valida Zod estricto + pertenencia de cid
       │                                    mapea cid → conceptId real
       │ ◄── {items:[{conceptId, quantity|null, reason}], questions, warnings}
  └─ revisión en el paso de capítulos
  └─ appendStructure(items, expected)   ← API existente, atómica, IDs nuevos
  └─ budgetMath / saveDraft / cuota     ← sin cambios
```

Decisiones concretas:

1. **Una pasada** con salida estructurada en lugar de dos (BG-006 preveía medir 1 vs 2). Con `output_config.format` y validación de esquema la normalización intermedia sobra en la mayoría de casos; mantener la segunda pasada solo si las evals lo justifican.
2. **Salida estructurada** con `client.messages.parse()` del SDK `@anthropic-ai/sdk` y esquema Zod en `functions/src/ai/contracts.ts`; validar otra vez en servidor (pertenencia, límites, `quantity` finita > 0 o `null` → `reviewRequired`). Nada de extraer JSON con regex. En Opus 5.5 y Sonnet 5.5 no se puede forzar `tool_choice` `any`/`tool`: usar `output_config.format`.
3. **No enviar precios al modelo**: a diferencia de BG-006 (`basePrice` en `Candidate`), la selección no los necesita y quitarlos reduce el riesgo de que el modelo "razone" importes. El precio entra en la hidratación del servidor.
4. **Secreto** con `defineSecret('ANTHROPIC_API_KEY')` (Secret Manager) en la Function; nunca en `.env`, `VITE_*` ni Firestore. Sin dependencias en el cliente.
5. **App Check obligatorio** (`enforceAppCheck: true`) + cuota por UID en una colección técnica `users/{uid}/aiUsage/{day}` escrita solo por Admin SDK y con `allow write: if false` en reglas; reserva atómica antes de llamar, reconciliación con `usage.input_tokens`/`output_tokens` después. 1 generación concurrente por UID.
6. **Límites por plan**: Free sin IA o con un cupo simbólico; premium con cupo diario. La cuota de IA es independiente de `totalBudgetsCreated` (ya decidido en BG-006 `:32`). Kill switch con Remote Config o documento `config/ai` leído por la Function.
7. **Prompt caching**: system prompt e instrucciones estables primero con `cache_control`; candidatos y texto del usuario al final. Útil solo si el prefijo estable supera el mínimo cacheable del modelo; medir con `usage.cache_read_input_tokens`.
8. **Rechazos**: comprobar `stop_reason` (`refusal`, `max_tokens`) antes de leer el contenido y devolver error recuperable; con Opus/Sonnet 5.5 considerar `fallbacks` del lado servidor.
9. **Privacidad y RGPD**: el texto libre puede contener datos del cliente final; la UI avisa de no incluirlos, el servidor redacta patrones y no registra prompts ni respuestas. Verificar antes de lanzar la política de retención del proveedor, la residencia de inferencia disponible para la UE y la base legal con un encargo de tratamiento; actualizar la política de privacidad del producto.
10. **Integración**: dentro de `features/budget-structure` como entrada alternativa al paso de selección, no como botón nuevo en la lista de presupuestos. Reutiliza revisión, cantidades pendientes y bloqueo de exportación ya existentes (`docs/architecture.md:61`).

### 4.2 Modelos recomendados

| Uso                                                                       | Modelo                                      | Configuración orientativa                                                                                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Selección de partidas en producción (ruta caliente)                       | **Claude Sonnet 5.5** (`claude-sonnet-5-5`) | `output_config.effort: "low"` o `"medium"`, salida estructurada, `max_tokens` ajustado al esquema (~2-4 K). Probar `thinking: {type: "between_tools"}` solo si la latencia lo exige. |
| Alternativa de bajo coste si las evals lo sostienen                       | **Claude Haiku 5.5** (`claude-haiku-5-5`)   | Mismo esquema; candidato natural para usuarios Free o para la redacción/clasificación previa. Decidir solo con datos del eval.                                                       |
| Construcción del dataset de evaluación, juez LLM y casos ambiguos offline | **Claude Opus 5.5** (`claude-opus-5-5`)     | Effort `high`; vía Batches para evaluaciones masivas (más baratas y sin latencia). El razonamiento no se puede desactivar en Opus 5.5: controlar con `effort`.                       |

**Precios**: no se fijan en este informe. Como referencia, la tabla en caché de la skill `claude-api` (03-11-2026) lista por millón de tokens entrada/salida: Opus 5.5 4 $/20 $, Sonnet 5.5 2 $/10 $, Haiku 5.5 0,10 $/0,50 $ (hasta 100 K de prompt). Verificar en la página oficial de precios antes de fijar cupos. Con los límites de BG-006 (≤12 K de entrada + 2 K de salida) el techo de 0,03 USD por solicitud fijado en `BG-006-baseline.md` (ADR 4) se cumple holgadamente con Sonnet 5.5 según esa tabla; recalcular con tarifas verificadas.

### 4.3 Evaluación

- Reutilizar `scripts/ai-baseline/evaluate.mjs` como **evaluador determinista** (esquema, pertenencia, duplicados, cantidades) adaptado a capítulos/partidas (contratos v2).
- Ampliar el corpus de 13 a ≥100 casos sintéticos estratificados (baño, cocina, integral, mixtos, sin cobertura, ambiguos, inyección de instrucciones, coma decimal, unidades m²/ml/ud). Cero PII real.
- Métricas: precisión/recall de partidas frente al oráculo, tasa de `null` correctos, preguntas cuando procede, rechazos de esquema, latencia p50/p95, tokens por solicitud. Umbral de lanzamiento fijado antes de mirar resultados.
- Juez LLM (Opus 5.5) solo para la calidad de las preguntas, validado contra una muestra etiquetada a mano.
- Regla: cada cambio de prompt/modelo/esquema pasa el eval en CI (job manual o nocturno, nunca en cada PR para no gastar).

---

## 5. Propuesta de estructura de contexto

### 5.1 `CLAUDE.md` mínimo (versionado en la raíz)

```markdown
@AGENTS.md

## Solo Claude Code

- Verificación rápida: `/verify` (skill del proyecto). Los hooks de `.claude/settings.json` ejecutan lint de los ficheros tocados.
- Delega la exploración amplia en subagentes `Explore` con `haiku`; quédate con la conclusión.
- `docs/archive/` no describe el estado actual.
```

Todo lo común a Codex y Claude va en `AGENTS.md`; `CLAUDE.md` solo añade lo específico de Claude Code. Nada duplicado.

### 5.2 Skills y subagentes de proyecto

```text
.agents/skills/                        # convención compartida (Codex y otros)
├── verify/SKILL.md                    # elige y ejecuta los checks según los ficheros cambiados
├── spec-new/SKILL.md                  # crea docs/specs/BG-0xx-slug/{spec,plan}.md desde plantilla y lo añade al índice
├── rules-change/SKILL.md              # protocolo de cambio de firestore.rules: test primero, emulador demo-, test:rules
└── doc-sync/SKILL.md                  # al cerrar una tarea: actualizar plan.md, estado de la spec y el doc del módulo
.claude/
├── settings.json                      # permisos y hooks (5.3)
├── skills -> ../.agents/skills        # enlace o copia, según soporte de la plataforma
└── agents/
    ├── firebase-rules-reviewer.md     # model: opus · revisa diffs de firestore.rules y functions/ contra docs/firebase.md
    ├── doc-drift-auditor.md           # model: haiku · compara los docs enrutados por la fila con el código tocado; informe ruta:línea
    └── e2e-triager.md                 # model: sonnet · lee test-artifacts/ y el log de Playwright; resume la causa
```

Ejemplo de `verify/SKILL.md` (esqueleto):

```markdown
---
name: verify
description: Ejecuta las comprobaciones de BudGenerator adecuadas a los ficheros cambiados y registra solo resultados reales.
---

1. `git diff --name-only main...` para listar cambios.
2. Siempre: `pnpm lint` y `pnpm exec tsc -b`.
3. `src/**` o `functions/src/**` → `pnpm test`.
4. `firestore.rules` o `functions/**` → `pnpm test:integration` (emuladores `demo-`).
5. UI → recorrido E2E afectado (`pnpm exec playwright test <spec>`) y captura 390/1440 px.
6. Cierre → `pnpm build`.
7. Informe: comando, resultado literal (n/total), fallos. Un fallo "conocido" no se acepta: se arregla o se marca con issue.
```

### 5.3 Guardarraíles: `.claude/settings.json` de proyecto

```json
{
  "permissions": {
    "deny": [
      "Bash(pnpm firebase:deploy*)",
      "Bash(firebase deploy*)",
      "Bash(git push*)",
      "Read(./docs/testing-access.local.md)",
      "Read(./.env)",
      "Read(./.env.*)"
    ],
    "ask": ["Bash(git commit*)", "Bash(gh pr merge*)"]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node scripts/agent-hooks/lint-changed.mjs" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "node scripts/agent-hooks/check-docs.mjs" }]
      }
    ]
  }
}
```

- `lint-changed.mjs`: `eslint` y `prettier --check` solo sobre el fichero editado (rápido; salida corta para no gastar contexto).
- `check-docs.mjs`: enlaces Markdown rotos, líneas > 400 caracteres en `docs/` no archivados, specs sin línea `Estado:`; también como paso de CI (`pnpm docs:check`).
- `.env.example` sigue legible; `Read(./.env.*)` lo bloquearía, así que conviene una excepción explícita o el patrón `Read(./.env.local)`.
- Sintaxis y comodines: comprobar con la documentación de Claude Code vigente antes de commitear.
- CI: además del arreglo de H-01, añadir `pnpm format:check` y `pnpm docs:check`; proteger `main` exigiendo el check (configuración de GitHub, decisión del usuario).

### 5.4 Árbol de documentación propuesto

```text
AGENTS.md                      # ≤60 líneas: contexto, enrutado, convenciones, seguridad, verificación
CLAUDE.md                      # @AGENTS.md + específico de Claude
docs/
├── plan.md                    # estado y pendientes (≤40 líneas)
├── product.md  architecture.md  firebase.md  state-and-cache.md
├── styles-and-responsive.md  performance.md  pdf-export.md  testing.md   # solo estado actual, por módulo
├── specs/
│   ├── README.md              # índice: ID | título | estado | spec | plan | evidencia | fecha
│   ├── _template/{spec.md,plan.md}
│   ├── BG-011-equipo/{spec.md, plan-01-planificacion.md, plan-02-trabajos.md, evidence/}
│   └── …
├── archive/                   # project-analysis, sdd-plan, stability-and-release, design-proposal,
│   ├── plan-history/2026-Q4.md                            # BG-002, BG-006 (+ ai-baseline), BG-007
│   └── BG-006/
└── analysis/                  # informes como este
```

Y la fila nueva en la tabla de `AGENTS.md`:

```markdown
| Una tarea con ID (BG-0xx) o una nueva funcionalidad | [Índice de specs](docs/specs/README.md) y solo la spec/plan de esa tarea |
```

### 5.5 Escalado a una app nativa en el ecosistema

- **Mantener repos separados** mientras no haya spec aprobada (regla de `AGENTS.md:5`). Si llega una app nativa (Swift/Kotlin o React Native) contra el mismo Firebase, lo compartido no es UI sino **contratos**: esquema Firestore, reglas, DTO público, `budgetMath` y callables.
- Extraer esos contratos a un documento canónico `docs/contracts/` (esquema por colección, versiones, invariantes de cálculo con casos de prueba en JSON) que ambos repos consuman. Los casos de `budgetMath` en JSON permiten tests de paridad web/nativa sin compartir código.
- Las reglas de Firestore y las Functions pertenecen a un único dueño (hoy este repo); la app nativa enlaza su `AGENTS.md` a ese contrato en lugar de copiarlo.
- Si en el futuro se opta por monorepo: `AGENTS.md` raíz (ecosistema, seguridad, verificación) + `apps/web/AGENTS.md`, `apps/ios/AGENTS.md`, `functions/AGENTS.md` (Codex los compone por directorio; Claude Code carga los `CLAUDE.md` anidados bajo demanda). La tabla de enrutado actual se convierte en la del paquete web.
- Las skills `verify` y `rules-change` se parametrizan por paquete; `firebase-rules-reviewer` pasa a ser el guardián común.

---

## 6. Plan por fases

| Fase                                                    | Contenido                                                                                                                                                                                                                   | Esfuerzo    | Riesgo                         | Criterio de cierre                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **0 · Esta semana**                                     | H-01 reparar CI (instalar `functions/`); regla "sin deploy con CI roja"; arreglar o marcar el test de `catalogTradeImport` citado en el histórico                                                                           | 1-2 h       | Bajo                           | 1 ejecución verde de CI en `main` con `test:integration` y `build` completos                                               |
| **1 · PR de contexto**                                  | Versionar `CLAUDE.md`; commitear la fusión de `.github/AGENTS.md` en `AGENTS.md`; `.claude/settings.json` con `deny`; corregir H-08 y H-09                                                                                  | 2-3 h       | Bajo                           | `AGENTS.md` ≤ 60 líneas; derivas de la tabla H-08 cerradas; deploy y lectura de secretos denegados                         |
| **2 · Reorganización documental**                       | `docs/archive/`; árbol único `docs/specs/` con índice y plantilla; mover sin reescribir; `docs:check` en CI                                                                                                                 | ½-1 día     | Medio (enlaces)                | Índice completo; 0 enlaces rotos; cada spec con estado                                                                     |
| **3 · Automatización de agentes**                       | Skills `verify`, `spec-new`, `rules-change`, `doc-sync`; subagentes; hooks `lint-changed` y `check-docs`                                                                                                                    | 1 día       | Bajo                           | Una tarea real cerrada usando `/verify` y `doc-sync` sin intervención manual en docs                                       |
| **4 · Poda continua**                                   | Reformatear docs de módulo al tocarlos (párrafos ≤ 400 car., sin fechas de entrega); partir `plan-history`                                                                                                                  | Continuo    | Bajo                           | Coste de cada fila ≤ ~5 K tokens                                                                                           |
| **5 · IA en producto (solo si el usuario la reactiva)** | Nueva spec BG-0xx sobre catálogo `parts/concepts`; contratos v2; evaluador y corpus ampliados; Function `proposeBudgetStructure` con App Check, secreto y cupos; integración en `budget-structure`; piloto con feature flag | 2-3 semanas | Medio-alto (coste, privacidad) | Eval sobre umbral fijado; tests de reglas/cuotas en emulador; revisión de privacidad; autorización explícita de despliegue |

---

## 7. Límites de este análisis

- No se ejecutaron `pnpm lint`, `pnpm test` ni `pnpm build` en el worktree; el diagnóstico de CI se basa en los logs de GitHub Actions.
- El comportamiento de carga de `AGENTS.md` por Claude Code se observó en esta sesión; puede variar por versión.
- No se revisaron `firestore.rules` ni el código de Functions más allá de lo citado.
- Los precios de modelos proceden de la tabla en caché de la skill `claude-api` (03-11-2026) y deben verificarse antes de usarlos en decisiones.
- El borrador de `AGENTS.md`/`CLAUDE.md` del checkout principal está sin commitear y puede cambiar.

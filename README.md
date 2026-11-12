# budgenerator

Aplicación web para profesionales que preparan presupuestos de servicios y reformas. El proyecto conserva el nombre **budgenerator**. La nueva identidad visual se aplica a acceso, navegación, panel, editores, PDF e instalación PWA.

Producción: [budgenerator.web.app](https://budgenerator.web.app/). El identificador técnico de Firebase sigue siendo `budgenerator`.

## Producto

- Presupuestos con cliente, partidas, conceptos, costes internos, IVA y descuentos/recargos.
- Valores decimales y cálculos monetarios compartidos por editor, visor público y PDF.
- Catálogos múltiples, 21 bases —incluida una vacía— y 211 tarifas sumadas entre las bases.
- Plantillas editables con catálogo, partidas, ajuste e IVA.
- Perfil de empresa y logo normalizado a PNG.
- PDF A4 con descripciones que se ajustan y cabeceras de continuación.
- Enlaces públicos sin costes internos, con caducidad de 30 días y revocación.
- Cuenta free con tres creaciones acumuladas y cuenta premium administrada manualmente.
- PWA con shell precacheado por versión, actualización controlada, indicador de conexión y recuperación de arranque.

## Stack

React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Zustand 5, Firebase 12 —Auth, Firestore y Hosting—, React Router 7, i18next y jsPDF 4. Tipografías Manrope y Fraunces alojadas con el proyecto. Tests con Vitest, Firebase Emulator Suite y Playwright.

Node >=24 y pnpm 10.33.0, fijado mediante `packageManager`.

## Desarrollo

```bash
pnpm install --frozen-lockfile
# Copiar .env.example a .env.local y rellenar la configuración.
pnpm dev
```

Vite sirve [localhost:3000](http://localhost:3000/). Se requieren las seis variables `VITE_FIREBASE_*` de `.env.example`. No versionar los valores privados de acceso a la cuenta ni archivos `.env` locales.

Para desarrollo aislado, utilizar un proyecto cuyo ID empiece por `demo-`, `VITE_USE_FIREBASE_EMULATORS=true` y:

```bash
pnpm firebase:emulators
```

Sin ese flag, la app accede al proyecto configurado en las variables locales. El worker de producción se desactiva durante desarrollo para no interferir con Vite.

## Scripts

| Script                                                                     | Qué hace                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                                 | Servidor de desarrollo de Vite.                                                                             |
| `pnpm build`                                                               | `tsc -b`, iconos, build de Vite, worker de notificaciones y service worker versionado.                      |
| `pnpm preview`                                                             | Sirve el build generado.                                                                                    |
| `pnpm lint` / `pnpm format:check`                                          | ESLint y comprobación de Prettier.                                                                          |
| `pnpm docs:check`                                                          | Enlaces Markdown rotos y línea `Estado:` en cada spec de `docs/specs/`.                                     |
| `pnpm test`                                                                | Pruebas unitarias con Vitest.                                                                               |
| `pnpm test:rules`                                                          | Reglas de Firestore (necesita emulador; ver `test:rules:emulator`).                                         |
| `pnpm test:rules:emulator`                                                 | Reglas dentro de un emulador de Firestore.                                                                  |
| `pnpm test:notifications:integration` / `pnpm test:notifications:emulator` | Pruebas de notificaciones, con y sin emuladores.                                                            |
| `pnpm test:e2e`                                                            | Recorridos de Playwright (`pnpm exec playwright install chromium` la primera vez).                          |
| `pnpm test:integration`                                                    | Compila Functions e inicia emuladores `demo-cimbra`: reglas y E2E contra un build real con datos ficticios. |
| `pnpm firebase:emulators`                                                  | Emuladores de Auth, Firestore y Functions.                                                                  |
| `pnpm build:functions`                                                     | Compila `functions/`.                                                                                       |
| `pnpm firebase:deploy` / `firebase:deploy:all` / `firebase:deploy:staging` | Despliegue de Hosting, de Hosting y reglas, o a staging.                                                    |

Antes de cerrar una tarea: `pnpm lint`, `pnpm build` y los tests que apliquen. CI ejecuta las comprobaciones sin publicar.

## Despliegue

Con el CLI autenticado en el proyecto correcto:

```bash
# Solo Hosting
pnpm firebase:deploy
# Entrega coordinada de Hosting y reglas
pnpm firebase:deploy:all
```

Los scripts comprueban variables y proyecto y rechazan configuraciones de emulador. La cuenta administradora de la app no es una credencial del CLI de Firebase.

La entrega de seguridad cambia el acceso a enlaces legacy y la representación del vencimiento premium. Revisar [Estabilización y entrega](docs/archive/stability-and-release.md) (archivo) antes de publicarla. Los snapshots inseguros antiguos se deben volver a compartir; las fechas premium antiguas se pueden volver a guardar desde administración para añadir su valor numérico.

## Estructura

```text
src/
├── app/          Sesión, guards, shell, router y PWA
├── pages/        Pantallas por ruta
├── features/     Editor de presupuestos, estructura, BC3, cuenta, notificaciones y tour
├── entities/     Auth, budget, catalog, construction-document, project, quote-estimator, template, workforce y más
└── shared/       Tipos, Firebase, cálculos, colas, UI e i18n
functions/        Cloud Functions
scripts/          Build, deploy, hooks de agentes y comprobación de docs
tests/            Regresión de stores, cálculos, privacidad, worker, reglas y navegador
docs/             Documentación (ver abajo)
```

## Documentación

Estado actual:

- [Plan vigente](docs/plan.md) — Estado y pendientes.
- [Producto](docs/product.md), [arquitectura](docs/architecture.md), [estado y caché](docs/state-and-cache.md), [Firebase](docs/firebase.md), [PDF](docs/pdf-export.md), [rendimiento](docs/performance.md), [estilos](docs/styles-and-responsive.md) y [pruebas y despliegue](docs/testing.md).
- [Especificaciones](docs/specs/README.md) — Índice con estado de cada spec; plantilla en `docs/specs/_template.md` y planes en `docs/specs/plans/`.

Trazabilidad (no describe el estado actual):

- [Archivo](docs/archive/README.md) — Plan histórico, análisis y propuestas cerradas.
- `docs/analysis/` — Análisis puntuales por área. `docs/testing-evidence/` — capturas de verificación.

La contraseña de la cuenta administradora de pruebas está en `docs/testing-access.local.md`, excluida de Git. Las pruebas automatizadas no la utilizan ni acceden a producción.

Proyecto privado.

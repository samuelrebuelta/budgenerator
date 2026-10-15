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

Node >=22.12 y pnpm 10.33.0, fijado mediante `packageManager`.

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

## Validación

```bash
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:integration
pnpm build
pnpm preview
```

`test:integration` inicia emuladores, prueba reglas y ejecuta el navegador contra un build real con configuración demo. Las cuentas y datos son ficticios. El build genera iconos, rutas separadas y un worker ligado al contenido de la versión. CI ejecuta las comprobaciones sin publicar.

## Despliegue

Con el CLI autenticado en el proyecto correcto:

```bash
# Solo Hosting
pnpm firebase:deploy
# Entrega coordinada de Hosting y reglas
pnpm firebase:deploy:all
```

Los scripts comprueban variables y proyecto y rechazan configuraciones de emulador. La cuenta administradora de la app no es una credencial del CLI de Firebase.

La entrega de seguridad cambia el acceso a enlaces legacy y la representación del vencimiento premium. Revisar [Estabilización y entrega](docs/stability-and-release.md) antes de publicarla. Los snapshots inseguros antiguos se deben volver a compartir; las fechas premium antiguas se pueden volver a guardar desde administración para añadir su valor numérico.

## Estructura

```text
src/
├── app/          Sesión, guards, shell, router y PWA
├── pages/        Pantallas por ruta
├── features/     Editor reutilizable de presupuestos y plantillas
├── entities/     Auth, budget, catalog, template, profile y user
└── shared/       Tipos, Firebase, cálculos, colas, UI e i18n
scripts/          Build de iconos/worker, entorno de pruebas y comprobación de deploy
tests/           Regresión de stores, cálculos, privacidad, worker, reglas y navegador
```

## Documentación

- [Plan SDD de interfaz](docs/sdd-plan.md) — Observaciones de revisión, decisiones y criterios de aceptación.
- [Propuesta visual aplicada](docs/design-proposal.md) — Marca, paleta, logo, decisiones y capturas.
- [Estabilización y entrega](docs/stability-and-release.md) — Correcciones, PWA, validación y transición de datos.
- [Despliegue y pruebas](docs/testing.md) — URL pública y acceso local para pruebas.
- [Arquitectura](docs/architecture.md), [estado](docs/state-and-cache.md), [Firebase](docs/firebase.md), [PDF](docs/pdf-export.md), [rendimiento](docs/performance.md) y [estilos](docs/styles-and-responsive.md).
- [Análisis inicial](docs/project-analysis.md) — Auditoría histórica del código anterior; sus hallazgos se contrastan con la entrega actual.

Cuenta admin de pruebas de producción: `budgenerator@gmail.com`. La contraseña está en `docs/testing-access.local.md`, excluida de Git. Las pruebas automatizadas no utilizan esa contraseña ni acceden a producción.

Proyecto privado.

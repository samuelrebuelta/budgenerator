# Despliegue y pruebas de Budgenerator

URL de producción: [https://budgenerator.web.app/](https://budgenerator.web.app/).

Cuenta de administración para pruebas: `budgenerator@gmail.com`. Desde el endurecimiento del 12-11-2026 el panel de administración exige el custom claim `admin` (ver [Firebase](firebase.md#administración)); asígnalo con `scripts/set-admin-claim.mjs` antes de desplegar las reglas nuevas.

La contraseña está en `docs/testing-access.local.md`, excluida expresamente de Git. Esa nota es específica de esta máquina y no se distribuye al clonar el repositorio. Mantener las contraseñas fuera de los documentos versionados.

## Entorno local

Desde la raíz del proyecto:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm install` en la raíz instala también los paquetes del workspace (`packages/*`, por ahora `@bg/domain`). Functions tiene su propia instalación: `pnpm --dir functions install --frozen-lockfile`.

La aplicación se abre en [http://localhost:3000/](http://localhost:3000/). Requiere las variables `VITE_FIREBASE_*` descritas en el README. La configuración actual no conecta emuladores; comprobar a qué proyecto apunta `.env` antes de crear o modificar datos durante pruebas locales.

## Validación previa al despliegue

```bash
pnpm lint
pnpm format:check
pnpm test                         # tests/ y packages/*/tests (dominio puro)
pnpm test:rules:emulator          # reglas en emulador, puertos alternativos 48xxx
pnpm test:notifications:emulator  # integración de Functions (avisos, cuenta, abuso, retención)
pnpm test:integration             # reglas + navegador con Auth, Firestore y Functions
pnpm build
```

`scripts/deploy.mjs` ejecuta por sí mismo lint, formato, unitarias, reglas y, si se despliegan Functions, su build e integración, y comprueba el bundle; la suite de navegador se confía a CI.

### Emuladores en puertos alternativos

`test:integration` y `firebase:emulators` usan los puertos por defecto de `firebase.json` (9199, 8180, 5001). Si están ocupados, copia `firebase.json` a `firebase.local-test.json` (ignorado por Git) con otros puertos y ejecuta, por ejemplo:

```bash
pnpm build:functions
pnpm exec firebase emulators:exec --config firebase.local-test.json --project demo-cimbra \
  --only auth,firestore,functions \
  "FUNCTIONS_EMULATOR_HOST=127.0.0.1:47301 E2E_PREVIEW_PORT=47173 pnpm test:rules && \
   FUNCTIONS_EMULATOR_HOST=127.0.0.1:47301 E2E_PREVIEW_PORT=47173 pnpm test:e2e"
```

`scripts/test-preview.mjs` propaga los puertos de Auth, Firestore y Functions al build de prueba y desactiva App Check. Los E2E marcan las cuentas sembradas como verificadas y dan el claim `admin` a la principal mediante la API del emulador.

## Desplegar en producción

El proyecto de Firebase Hosting configurado en `.firebaserc` es `budgenerator`.

Con el CLI de Firebase autenticado y permisos en ese proyecto, desde `main` limpio y con CI en verde:

```bash
pnpm firebase:deploy:all     # hosting, rules, indexes y functions
node scripts/deploy.mjs functions,rules   # objetivos concretos
pnpm firebase:deploy:staging # cuando exista el proyecto de staging
```

El script valida y construye antes de desplegar; ver [Operación y despliegue](firebase.md#operación-y-despliegue). Después se puede probar el resultado en [Budgenerator](https://budgenerator.web.app/).

La cuenta de administración de la aplicación no autentica al CLI de Firebase. El despliegue requiere la sesión de Google/Firebase del desarrollador con permisos sobre el proyecto.

Para cambios que afecten exclusivamente a Hosting se puede usar:

```bash
pnpm firebase:deploy
```

Los scripts usan el CLI local fijado por el lockfile y comprueban que el entorno no sea de emuladores. Para publicar cambios de reglas, utilizar el despliegue conjunto y revisar las consideraciones de transición en [`archive/stability-and-release.md`](archive/stability-and-release.md).

## Pruebas con escritura

Las pruebas automatizadas y las comprobaciones con escritura se hacen en emuladores con un `projectId` `demo-` y datos ficticios. No se modifican datos reales ni se verifica producción con la cuenta administradora. Los fallos de aislamiento o permisos se reproducen con el emulador.

## Comprobaciones de la entrega (15 de octubre de 2026)

La revisión posterior y sus correcciones se validan con tests unitarios, reglas en emulador y navegador automatizado: `pnpm test` y `pnpm test:integration`. Las pruebas no utilizan la cuenta de producción; crean cuentas y datos ficticios en `demo-cimbra`.

## BG-007 (16 de octubre de 2026)

24 unitarias y 12 reglas correctas; 15 recorridos de navegador correctos en emuladores `demo-cimbra`, incluidos gestos con Input.dispatchTouchEvent de Chromium (scroll vertical, reveal y bloqueo de navegación accidental), teclado/modal, rutas/drafts, logo fallido/apaisado, ayuda y matriz responsive. Lint, build/TypeScript y formato correctos. Capturas `bg007-*.png` inspeccionadas en desktop y móvil. Revisión independiente sin bloqueantes. Ninguna prueba usó datos de producción. Pendiente QA táctil de iOS Safari/PWA y Android físico; no se presume a partir de Chromium.

## BG-008 (16 de octubre de 2026)

`codex/bg008-catalog`: lint, build y formato correctos; 45 unitarias, 14 pruebas de Firestore y 19 E2E correctos. Emuladores exclusivamente demo. Las nuevas comprobaciones cubren inicialización concurrente/idempotente y aislamiento, reintentos de limpieza, búsqueda/orden, ruta única y enlaces antiguos, tarifas sobre presupuesto con referencia histórica, plantilla responsive, asistente con cancelación/retroceso/confirmación, medición pendiente bloqueando PDF, recuperación y sugerencias por historial, instalación PWA simulada y descarte. Se mantienen los recorridos de navegación, cuotas, teclado, gestos, PDF público, offline y actualización.

Capturas específicas `docs/testing-evidence/bg008-*`: catálogo y revisión de estructura a 320 px/escritorio, selección de trabajos a 390 px/escritorio y formulario de plantilla a 320 px. Inspección visual realizada; detector de Impeccable sin hallazgos. Pendiente prueba de instalación en dispositivos reales; no se ha desplegado esta entrega ni se han usado datos de producción en las pruebas.

## BG-008: catálogo Partidas/Conceptos (17 de octubre de 2026)

La ampliación local conserva el catálogo como partidas con conceptos y adapta catálogos planos durante la carga. Los editores siguen guardando snapshots; las nuevas selecciones conservan IDs de origen opcionales y privados. El flujo guiado elige partidas y después sus conceptos, y calcula sugerencias por ID con fallback histórico para snapshots antiguos.

Verificado: 52 unitarias, 16 pruebas de reglas/emulador, 21 E2E, `pnpm lint`, `pnpm build` (PWA `925c1b35fa760bb8`) y `pnpm format:check`. La integración pasó completa en emuladores `demo-cimbra`; el flujo guiado y el guardado de partidas/conceptos también se comprobaron en E2E. La revisión independiente no encontró hallazgos pendientes. Desplegada sólo a Hosting el 17-10-2026 en https://budgenerator.web.app. HTML y service worker remotos coinciden con el build. No se cambiaron reglas ni se usaron datos de producción en las pruebas. La validación física PWA permanece pendiente.

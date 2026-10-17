# Catálogo por categoría y tour de bienvenida — Plan de implementación

**Objetivo:** Mejorar la importación selectiva del catálogo y orientar a las nuevas cuentas hasta la creación de su primer presupuesto.

**Arquitectura:** La importación mantiene las bases estáticas actuales y amplía la fusión pura para aceptar una categoría completa, una partida o un concepto. El tour vive en la shell autenticada, usa navegación real, estado local por UID y una ilustración SVG propia; se puede omitir y volver a abrir desde Ayuda.

**Tecnología:** React, TypeScript, React Router, Zustand, Vitest y Playwright existentes; sin dependencias ni escrituras nuevas en Firebase.

**Spec:** `docs/specs/BG-008-catalogo-unico-y-creacion-guiada.md` y este pedido del 17-10-2026.

## Límites globales

- Mantener la jerarquía `partida → conceptos` y no duplicar ni sobrescribir valores personalizados al importar.
- Mostrar selectores sólo cuando reciben foco; mantener foco visible para navegación por teclado.
- Respetar el diseño y la paleta existentes, el área segura móvil y `prefers-reduced-motion`.
- El tour se lanza tras el alta correcta, no tras iniciar sesión; se puede omitir, repetir y recorrer navegando con los enlaces reales.
- No modificar Firestore Rules, datos remotos, planes, cuentas ni el flujo de creación de presupuestos.

## Foco de revisión

- Una importación de concepto/partida no añade sus hermanos; las importaciones repetidas no crean duplicados.
- Un duplicado por descripción y unidad conserva precio/coste personalizados; otra unidad sigue siendo un concepto distinto.
- El botón para añadir conceptos se oculta en partidas contraídas sólo en móvil; el botón de escritorio expande la partida antes de abrir el formulario.
- El alta fallida y el inicio de sesión no lanzan el tour; cambiar de usuario no reutiliza el estado de otra cuenta.
- Durante el tour los enlaces reales siguen funcionando, el estado acompaña la ruta, y Esc/omitir/terminar cierran sin bloquear la app.

## Tareas

### Tarea 1: Importar por categoría, partida o concepto

**Archivos:** `src/entities/catalog/model/tradeImport.ts`, `src/entities/catalog/model/store.ts`, `src/pages/catalogs/CatalogDetailPage.tsx`, `tests/catalogTradeImport.test.ts`, `tests/catalogStore.test.ts`, `tests/e2e/app.spec.ts`.

- [x] Añadir primero tests de fusión que pidan una partida y un concepto concretos; ejecutarlos y confirmar que fallan por importar toda la base.
- [x] Añadir selección tipada a la fusión y al store; filtrar por nombre normalizado de partida y por descripción/unidad de concepto.
- [x] Cambiar el modal a “Importar por categoría”, mostrar que el contenido es un punto de partida para el catálogo de la empresa y permitir abrir el detalle de cada categoría.
- [x] En el detalle, permitir desplegar conceptos e importar la categoría completa, una partida o un concepto individual con un único contenedor de scroll.
- [x] Actualizar E2E para las tres escalas, la búsqueda, los mensajes y la ausencia de duplicados.

### Tarea 2: Estado contraído y foco de selectores

**Archivos:** `src/pages/catalogs/CatalogDetailPage.tsx`, `src/index.css`, `tests/e2e/app.spec.ts`.

- [x] Añadir prueba responsive: sin acción de añadir concepto en partida contraída a 390 px; visible en escritorio y expande la partida al activarse.
- [x] Renderizar la acción sólo en móvil cuando la partida está expandida y expandir antes de abrir el alta en escritorio.
- [x] Añadir prueba de foco real en un `<select>` y aplicar outline mientras el selector está activo, preservando el modo de foco de los modales.

### Tarea 3: Tour de bienvenida

**Archivos:** `src/features/app-tour/model.ts`, `src/features/app-tour/AppTour.tsx`, `src/app/AppShell.tsx`, `src/pages/login/LoginPage.tsx`, `src/pages/help/HelpPage.tsx`, páginas de destino, `src/index.css`, tests del modelo y `tests/e2e/app.spec.ts`.

- [x] Probar primero el estado por UID, la marca de alta pendiente y el cierre; confirmar RED antes de implementarlo.
- [x] Devolver el UID del alta correcta y marcarla en `sessionStorage`; no marcar sesiones de acceso existentes.
- [x] Añadir un tour de cuatro paradas por Presupuestos, Catálogo, Plantillas y Mi empresa, con spotlight no modal, enlaces utilizables, avance/retroceso/omitir, SVG animado y movimiento reducido.
- [x] Añadir “Ver guía interactiva” a Ayuda para repetirlo; recordar cierre por UID en `localStorage` y tolerar almacenamiento bloqueado.
- [x] Cubrir alta correcta, omisión, navegación entre destinos y repetición con pruebas.

### Tarea 4: Contratos y verificación

**Archivos:** `docs/plan.md`, `docs/specs/BG-008-catalogo-unico-y-creacion-guiada.md`, `docs/architecture.md`, `docs/state-and-cache.md`, `docs/styles-and-responsive.md`.

- [x] Registrar la importación jerárquica y el almacenamiento local del tour; aclarar que no hay escrituras ni reglas nuevas.
- [x] Ejecutar checks específicos, después `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm build` y `pnpm format:check`.
- [x] Revisar capturas responsive del modal y del tour, ejecutar una vez el detector Impeccable en los objetivos cambiados y anotar resultados pendientes.
- [x] No desplegar, fusionar ni crear datos de producción.

**Verificación:** 60 unitarios, 16 reglas y 27 E2E en `demo-cimbra`; lint, build y formato correctos. Build normal: PWA `b0f3ecf6be0ff903`. Capturas desktop/móvil revisadas y detector Impeccable `[]`. Sin deploy, merge ni cambios de Firestore Rules.

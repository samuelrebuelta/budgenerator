# BudGenerator — Plan SDD

Actualizado: 2026-10-18. Fuente operativa de tareas. La especificación y el código local no equivalen a autorización de merge o despliegue.

## Orden de trabajo

**BG-008 integrado en `main` local y remoto, y desplegado.** Hosting publica el build PWA `b0f3ecf6be0ff903`; el HTML y el service worker coinciden con el build. Sólo se publicó Hosting, sin cambios de reglas o datos. La integración con IA se eliminó del roadmap y su documentación queda archivada. GitHub quedó sincronizado con la cuenta personal `samuelrebuelta`; el checkout original conserva sus cambios locales sin sobrescribir.

1. **BG-007 y BG-008:** entregas funcionales completadas e integradas en `main`; la comprobación en PWA física queda como seguimiento opcional, sin bloquear el cierre. No quedan tareas de merge o despliegue de esta entrega.
2. **IA:** fuera del roadmap vigente por decisión del usuario (18-10-2026). El wizard es el flujo actual de creación guiada; no hay integración de IA planificada ni trabajo abierto de BG-006.
3. BG-004 sigue en revisión y BG-005 requiere definición; no introducir cambios de planes, administración, CRM o facturación como parte de UX.

## Estado

| ID     | Estado      | Prioridad                | Entrega                                                                                                                                                                                                                  |
| ------ | ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BG-001 | Completado  | Crítica                  | Reglas de Firestore y 12 pruebas de emulador.                                                                                                                                                                            |
| BG-002 | Completado  | Alta                     | Skeletons, textos, navegación de cuenta y estado de guardado. Ver `docs/specs/BG-002-refactor-ui.md` y `docs/sdd-plan.md`.                                                                                               |
| BG-003 | Completado  | Alta                     | Base de pruebas de cálculos, stores, PDF y PWA.                                                                                                                                                                          |
| BG-004 | En revisión | Media                    | Documentación y contratos reconciliados; pendiente decidir alcance de free/premium y administración.                                                                                                                     |
| BG-005 | Pendiente   | Media                    | Definir encaje de Web Factory Lite en el ecosistema, sin integración de código ni monorepo implícitos.                                                                                                                   |
| BG-007 | Completado  | Alta · Cerrado           | UX y navegación desplegadas; queda como seguimiento opcional verificar teclado, safe-area y gestos en PWA física. Ver `docs/specs/BG-007-design-ux-consistency.md` y `docs/specs/BG-007-execution.md`.                    |
| BG-008 | Completado  | Alta · Cerrado           | Código integrado en `main` local y remoto y desplegado en Hosting; catálogo, importación selectiva, wizard y tour publicados. Verificación automática completa. Ver `docs/specs/BG-008-catalogo-unico-y-creacion-guiada.md`. |

## Reconciliación del 16 de octubre

Se recuperaron los tres commits documentales de `origin/main` que faltaban en el checkout anterior. BG-007 ya estaba especificado pero no registrado aquí. El documento local `BG-006-generacion-inteligente.md` era un registro del prototipo de catálogo, no la especificación original ni una autorización de implementación: se conserva como tal en el checkout original. El código adelantado permanece intacto en `feat/bg-006-intelligent-budget`; no se mezcla en BG-007 ni se descarta.

BG-007 se trabaja aisladamente en `feat/bg-007-design-ux`, desde `origin/main`. No se activan proveedores de IA, servicios, secretos, planes ni cambios de producción. BG-007 está desplegado; el usuario retoma BG-006 el 16-10-2026 con preparación exclusivamente local.

## Flujo y validación

Una entrega revisable por fase. Primero comprobaciones específicas, después `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build` y `pnpm format:check`. No afirmar resultados no ejecutados; los cambios de reglas exigen emuladores. Actualizar spec y contratos afectados. No auto-merge ni despliegue sin autorización explícita.

## BG-007 — entrega local en revisión

Área segura PWA: configurado `viewport-fit=cover`. Por ajuste solicitado por el usuario, la separación inferior de la barra es únicamente `env(safe-area-inset-bottom, 0px)`, sin los 12 px adicionales. Cambio local pendiente de publicación y validación física en PWA instalada.

Implementados cabeceras comunes, retornos seguros, controles de 44 px, estados interactivos, avatar con logo/fallback, tabbar flotante, acciones por swipe con menú alternativo y confirmación, `/help` e información contextual. Sin cambios en stores, reglas, cálculos o PDF. Revisión independiente sin bloqueantes. Capturas comparadas en escritorio y móvil; comprobaciones automáticas de 320, 390, 430 y 768 px. El gesto nativo de Chromium verifica scroll, captura de puntero y ausencia de navegación/borrado involuntarios.

Pendientes: revisión del usuario y comprobación física de teclado/safe-area/gestos en Safari y PWA de iOS/Android. Fusionado por fast-forward en `main` local (fe20837) y desplegado en https://budgenerator.web.app el 16-10-2026. Push/PR/merge remoto pendientes: GitHub rechaza con 403 la cuenta activa `samuelrebueltainditex`. La copia de trabajo de UX es `/Users/srebuelta/.codex/worktrees/bg-007-ux/renovation-budget-generator`. El checkout original conserva BG-006 intacto; no es la copia para previsualizar BG-007.

Verificación de publicación: configuración de producción validada para `budgenerator`; despliegue sólo Hosting correcto, versión PWA `5d1b54b8e6aaddd5`. HTML y service worker remotos coinciden byte a byte con `dist`. Suite previa al merge: 24 unitarias, 12 reglas y 15 E2E; lint, formato y build correctos. Unitarias repetidas tras la fusión local: 24 correctas. Sin cambios de datos ni reglas.

Ajuste solicitado tras publicar BG-007: segundo nivel sin tabs y sin cabecera global móvil; desktop conserva cabecera global y sidebar. Se mantienen retorno y estado de guardado. Implementación local en `codex/bg007-detail-navigation`; Verificado: lint, formato, build, 24 unitarias, 12 reglas y 15 E2E correctos; capturas móvil/desktop revisadas. Ajuste publicado en Hosting el 16-10-2026.

Verificación del ajuste inferior de tabs: lint y build correctos; recorrido E2E de matriz visual correcto (320/390/430/768 px y escritorio). Publicado en Hosting el 16-10-2026; pendiente validación física de insets.

Refinamiento del segundo nivel: cabecera global visible en todos los niveles desktop y oculta en detalle móvil. Retorno solo en la primera fila del PageHeader; título y acciones debajo, en móvil y desktop. Publicado en Hosting el 16-10-2026. Verificados lint, formato, build, 12 reglas y 15 E2E; capturas móvil y desktop revisadas. Corregido montaje duplicado del estado de guardado.

Despliegue de ajustes confirmado: `pnpm firebase:deploy` correcto, PWA `8ce494ef62b1c8df`. HTML y service worker remotos idénticos al build de producción. GitHub continúa pendiente de sincronización por permisos; sin cambios de reglas ni datos.

Ajustes solicitados el 16-10: eliminado slide hacia la izquierda para borrar en todos los listados; borrado por menú y confirmación, conservando swipe derecho de catálogo predeterminado. Margen superior de detalles reducido 12 px (26 px desktop / 12 px móvil). Pulsar la tab móvil actual sube al inicio con scroll suave y respeta reduced-motion. Verificación: lint, formato, build, 24 unitarias, 12 reglas y 15 E2E correctos; gesto nativo sin borrado y scroll-to-top comprobados. Fusionado en main local (139e0c4) y desplegado en Hosting el 16-10-2026, PWA 3aaf428eb3d4e4ae. HTML y service worker remotos coinciden con el build de producción. Push remoto rechazado con 403 para samuelrebueltainditex; sincronización GitHub pendiente.

Corrección de navegación entre tabs: destino siempre arriba al cambiar de pestaña; tab activa mantiene scroll suave. Verificados lint, build y E2E de navegación (incluye scroll previo al cambio por las cuatro tabs). Fusionado en main local (5fdf0f5) y publicado en Hosting, versión PWA 3740a7edcad246a1. HTML y service worker remotos coinciden con el build; 24 unitarias y formato también correctos. Sincronización GitHub pendiente por el 403 ya registrado.

## Archivo histórico de BG-006

El 18-10-2026 el usuario retiró la integración de IA del roadmap. `docs/specs/BG-006-*`, `scripts/ai-baseline/` y su corpus quedan como material histórico, sin implementación planificada, proveedor, benchmark pendiente ni trabajo abierto.

## BG-008 — catálogo único y creación guiada

La ampliación se implementó en `codex/bg008-catalog`, checkout aislado `/Users/srebuelta/.codex/worktrees/bg008-catalog/renovation-budget-generator`. El prototipo de BG-006 y los cambios anteriores del checkout original siguen intactos. Datos de prueba prescindibles según autorización del usuario; no se ejecutó vaciado remoto. `/catalog` es la ruta canónica y los enlaces antiguos redirigen.

La base: lint, formato, 45 unitarias, 14 pruebas de Firestore, 19 E2E y build correctos (PWA `d0b3ddd6467b6797`); desplegada para prueba. La extensión tiene checks y revisión independiente completos. Hosting se actualizó el 17-10-2026; no hubo merge ni despliegue de reglas.

Extensión Partidas/Conceptos (17-10-2026): persistencia anidada con migración de catálogo plano idempotente; selectores del editor y asistente usan IDs de partida/concepto; presupuestos/plantillas mantienen snapshots históricos y los nuevos snapshots conservan IDs opcionales. Verificados 52 unitarias, 16 reglas, 21 E2E, lint, build (PWA `925c1b35fa760bb8`) y formato. Revisión independiente sin hallazgos pendientes. Desplegada sólo a Hosting el 17-10-2026 en https://budgenerator.web.app; HTML y worker remotos idénticos al build. Sin merge ni despliegue de reglas. PWA física pendiente.

Ajustes posteriores a la publicación: añadido control de expandir/contraer todas las partidas y foco visible en modales sólo desde navegación por teclado. Verificados 52 tests unitarios, 16 tests de reglas, 2 E2E específicos, lint, formato y build. Desplegado sólo a Hosting el 17-10-2026 en https://budgenerator.web.app, PWA `7e9bcba0176490b1`; HTML y service worker remotos idénticos al build. Sin cambios de datos ni reglas.

Mejora posterior (17-10-2026): wizard dinámico con un paso por partida elegida, todos sus conceptos sin sugerencias populares y cantidad opcional por concepto. Volver conserva selección y cantidades; el resumen muestra las cantidades indicadas y deja las vacías pendientes. Verificados 53 unitarias, 16 reglas, 22 E2E, lint, formato y build (PWA `1f176b315aca65ca`). Desplegado sólo a Hosting el 17-10-2026 en https://budgenerator.web.app; HTML y service worker remotos coinciden con el build. Sin cambios en reglas ni datos.

Ajustes de diseño solicitados el 17-10-2026: retirados los pretítulos de página; acciones para crear partidas, presupuestos y plantillas junto al título (compactas con icono en móvil); banner del borrador alineado al contenido; botones iguales “Descartar” y “Guardar”; filtro por año combinado con búsqueda; lupa centrada; orden de navegación: Presupuestos, Plantillas y Catálogo. Verificados 53 unitarias, 16 reglas, 24 E2E, lint, formato y build (PWA `2cde1e1e302ba725`); filtro anual repetido tras el último ajuste y capturas revisadas en escritorio y móvil. Desplegado sólo a Hosting el 17-10-2026 en https://budgenerator.web.app; HTML y service worker remotos coinciden con el build. Sin cambios en reglas ni datos.

Ajuste y publicación del 17-10-2026: retirado el footer global; `/catalog` permite buscar e importar partidas/conceptos de los 19 oficios especializados ya incluidos en las bases. La vista previa enseña categorías y recuentos; la importación omite duplicados por descripción/unidad, no pisa valores personalizados y mantiene la creación manual. Capturas verificadas en escritorio y móvil: `docs/testing-evidence/bg008-trade-import-desktop.png` y `bg008-trade-import-mobile.png`. Comprobados 56 unitarios, 16 tests de reglas, 25 E2E, lint, formato y build (PWA `0b60a78045085d16`). Desplegado sólo a Hosting el 17-10-2026 en https://budgenerator.web.app; HTML y service worker remotos coinciden byte a byte con `dist`. Sin merge, cambios de reglas ni modificaciones de datos. Prueba física PWA pendiente.

Ajustes posteriores (17-10-2026, en revisión local): el importador permite elegir categoría, partida o concepto; los controles principales permanecen fijos mientras la lista conserva un solo scroll y filas legibles en móvil. El alta de una cuenta nueva abre una guía opcional con personaje ilustrado por Presupuestos, Catálogo, Plantillas y Mi empresa; se puede omitir y repetir desde Ayuda, sin datos nuevos en Firebase. También se oculta “Añadir concepto” en partidas contraídas sólo en móvil y se muestra outline en los selectores activos. Verificados 60 unitarias, 16 reglas y 27 E2E en `demo-cimbra`, lint, build y formato (PWA `b0f3ecf6be0ff903`); detector Impeccable sin hallazgos. Capturas revisadas: `bg008-category-import-{desktop,mobile}.png` y `bg008-welcome-tour-{desktop,mobile,profile}.png`. Sin despliegue ni merge.

Cierre BG-008 (18-10-2026): importación selectiva, tour de bienvenida y ajustes responsive integrados en `main` local y remoto; verificación: lint, formato, build, 60 unitarias, 16 reglas y 27 E2E. Desplegado sólo a Hosting el 18-10-2026, PWA `b0f3ecf6be0ff903`; HTML y service worker remotos coinciden con `dist`. Sin cambios de reglas ni datos. La integración IA se retiró del plan activo; no quedan tareas BG-006. Sin tareas de merge o despliegue pendientes.

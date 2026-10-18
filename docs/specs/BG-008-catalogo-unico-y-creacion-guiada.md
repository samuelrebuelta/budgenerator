# BG-008 — Catálogo único y creación guiada

Estado: integrado en `main`, verificado y desplegado en Hosting. Versión PWA `b0f3ecf6be0ff903`; HTML y service worker remotos coinciden con `dist`. Fecha de actualización: 2026-10-18.

## Objetivo y autorización

Simplificar el mantenimiento del catálogo y la preparación de presupuestos, conservando el editor, cálculos, exportación y guardado existentes. El usuario confirma que todos los datos actuales son de prueba y autoriza borrarlos si hace falta. No se ejecuta un vaciado global ni un despliegue como efecto implícito.

Base de implementación: versión vigente del worktree `bg-007-ux`, actualmente `699b935`; verificar HEAD antes de ejecutar y crear aislamiento desde esa revisión. El checkout original conserva cambios locales de BG-006 que no deben copiarse, sobrescribirse ni descartarse.

## Comportamiento propuesto

1. Un catálogo por cuenta, llamado «Mi catálogo». `/catalog` abre directamente su editor; `/catalogs` redirige a `/catalog`. Eliminar creación de catálogos adicionales, selección de catálogo activo y selectores de catálogo en presupuesto y plantilla. Mantener la edición de conceptos, categorías, unidades, costes y precios.
2. Crear el catálogo inicial de forma idempotente con ID determinista si no hay ninguno. Decisión propuesta: usar la base `reformas_integrales` existente. Para cuentas con varios, conservar el activo válido, o el primero por ID si no existe activo. Guardar el destino antes de retirar los sobrantes. No borrar presupuestos ni plantillas: sus importes y conceptos son snapshots; las referencias antiguas no impedirán editar ni acceder al catálogo único. No vaciar datos de otros usuarios para resolver este caso.
3. Mantener temporalmente los contratos de almacenamiento compatibles con el esquema actual. Las rutas antiguas `/catalogs` y `/catalogs/:catalogId` redirigen a `/catalog`. No cambiar reglas ni introducir una migración de producción automática sin pruebas contra emuladores.
4. Buscador accesible en el control «Aplicar tarifa del catálogo» del editor. Buscar por descripción y categoría ignorando mayúsculas y tildes, sobre todo el catálogo, aunque el capítulo actual tenga otra categoría. Mostrar unidad y precio, estado vacío y cierre con Escape; aplicar una tarifa conserva el comportamiento actual sobre cantidad y resto del presupuesto.
5. Listados del catálogo y resultados de selección ordenados por descripción con comparación española; categorías alfabéticas. Mantener el orden manual de capítulos y conceptos ya incorporados al presupuesto.
6. Redondear las tarjetas de presupuestos y plantillas con el token existente adecuado; incluir contenedor, foco, menú y recorte de acciones para que los bordes no queden cuadrados. Preservar identidad y densidad.
7. Corregir «Guardar como plantilla»: etiqueta accesible, input que puede encoger, controles que se reorganizan a 320 px, nombre largo sin desbordamiento, estado de guardado y error actuales. Enter guarda una sola vez; cancelar no crea plantilla.
8. Banner compacto de instalación en la shell, próximo a la cabecera y sin tapar contenido. Oculto en modo standalone y tras `appinstalled`; descartar durante la sesión. Capturar `beforeinstallprompt` antes del montaje de la shell, ofrecer instalación cuando existe y consumir el evento una sola vez. En iOS ofrecer instrucciones de compartir y añadir a inicio; en otros navegadores sin evento, instrucciones de menú sin afirmar que la instalación está disponible. La cancelación no se presenta como instalación correcta. Respetar los avisos de conexión y actualización existentes, impresión y vistas públicas.

## Ajustes posteriores: footer e importación por oficio

En `/catalog`, retirar el footer común de la shell. El importador permite buscar 19 oficios especializados incluidos en las bases existentes, revisar sus partidas y conceptos agrupados antes de importar y editar después unidades, costes y precios. Fusionar por nombre de partida normalizado y evitar duplicados por descripción/unidad, conservando los datos que el usuario ya personalizó. Se mantienen los formularios para crear partidas y conceptos manualmente; no se incorporan precios de mercado externos.

## Importación selectiva y bienvenida guiada

El modal se denomina “Importar por categoría”. Explica que las bases sirven de inspiración, que se pueden crear más partidas y conceptos y que los elementos seleccionados pasan al catálogo de la empresa para usarlos en presupuestos. La pantalla inicial permite buscar categorías e importar una completa; “Ver detalle” abre una vista con partidas plegables y acciones para importar la categoría, una partida o un concepto. Los controles de contexto permanecen visibles y sólo la lista usa scroll. En partidas contraídas se oculta la acción de añadir concepto en móvil, se conserva en escritorio y expande la partida al pulsarla. Los selectores muestran foco visible al activarse.

Tras un registro correcto se inicia una guía breve con un reformista ilustrado que recorre Presupuestos, Catálogo, Plantillas y Mi empresa. Resalta los controles de cada pantalla sin bloquear su interacción, permite avanzar, retroceder u omitir, y se puede repetir desde Ayuda. No se activa al iniciar sesión en una cuenta existente ni guarda progreso en Firebase; el UID pendiente vive en `sessionStorage` y el cierre se recuerda por cuenta en `localStorage`. Respeta movimiento reducido.

## Extensión del catálogo base para BG-009

El importador ofrece 20 bases: la nueva `Reforma general` más los 19 oficios especializados existentes. `Reforma general` contiene ocho familias de trabajo amplias y 19 conceptos de ejemplo; electricidad se presenta como una sola familia. Las cuentas nuevas se inicializan con esta base general. Las cuentas existentes no se migran: pueden importarla manualmente, sin duplicar descripción/unidad ni sustituir precios personalizados. `En blanco` y la antigua base integral no se ofrecen como bases de importación.

El tour de bienvenida incorpora Proyectos como primera parada y explica que el seguimiento parte de aceptar y convertir un presupuesto. Mantiene el recorrido por Presupuestos, Catálogo, Plantillas y Mi empresa, ahora con cinco pantallas.

## Asistente opcional de estructura

Entrada «Crear paso a paso» en presupuesto nuevo; continuar disponible la edición directa. Sin IA, proveedores ni nuevas dependencias. Separado de BG-006.

1. Elegir partidas reales del catálogo, con selección múltiple.
2. Recorrer un paso por cada partida elegida, en su orden de selección. Mostrar todos los conceptos de esa partida, sin ranking o filtro de popularidad, con búsqueda local al paso. El usuario puede marcar cualquier concepto e indicar una cantidad opcional; mantener conceptos y cantidades al retroceder o avanzar. Una cantidad vacía se convierte en cero y sigue pendiente para la validación normal.
3. Revisar partidas, conceptos y cantidades; permitir quitar y reordenar partidas. No crear partidas vacías ni conceptos duplicados por combinación de IDs. Volver conserva selección y cantidades; cancelar no modifica el presupuesto.
4. Confirmar una sola vez añade la estructura y abre el editor normal. Las cantidades vacías empiezan sin completar, usando la representación existente de concepto incompleto; no inferir mediciones ni costes. Precio, coste y unidad proceden del catálogo. Exportar/publicar exige completar las cantidades según la validación actual. Abrir el asistente no consume cuota; se mantiene la creación habitual al guardar el presupuesto.

Si cambia la sesión, el documento o el catálogo durante la revisión, bloquear la incorporación y pedir revisar de nuevo. Usar IDs nuevos, incorporación atómica y protección contra doble confirmación. No modificar IVA, ajustes, cliente ni conceptos previos. Movimiento reducido, navegación de teclado, foco al cambiar de paso y retorno al cerrar.

## Exclusiones

Sin cambios de planes, administración, IA conectada, PDF, fórmulas, CRM, dependencias o backend nuevo. Sin merge ni despliegue implícitos. Sin incorporar el prototipo previo de BG-006 por copia de archivos.

La extensión BG-008 aprobada el 17-10-2026 persiste `CatalogPart[]` con conceptos anidados. La migración adapta el catálogo plano durante la carga; los presupuestos y plantillas existentes no se reescriben. Las nuevas copias mantienen IDs de origen privados opcionales. La publicación del 17-10-2026 incluye la extensión y el importador de oficios; se limita a Hosting, sin cambios de reglas ni datos.

## Aceptación y verificación

- Unitarias: inicialización idempotente y reintento de consolidación; sesión obsoleta; orden español y búsqueda con tildes; ranking sin historial y sin colisiones; confirmación atómica, cantidades incompletas y doble incorporación.
- Emuladores: cuenta vacía y cuenta con varios catálogos; errores/reintentos sin pérdida del destino; presupuesto/plantilla con referencia antigua; aislamiento entre cuentas.
- Navegador: acceso directo al catálogo, ausencia de selectores, buscar y aplicar tarifa, formulario de plantilla a 320 px, cards y foco en móvil/escritorio, asistente completo/cancelación/retroceso/recarga, guardado y validación de exportación.
- Catálogo único: footer global ausente en páginas raíz y detalle; buscar un oficio, ver agrupaciones, importar, repetir sin duplicar y conservar conceptos/precios personalizados; creación manual disponible.
- Importación selectiva: búsqueda, detalle y scroll único; importar categoría, partida y concepto; acciones principales fijas y filas legibles en móvil.
- Guía: alta, omisión, navegación real entre destinos, cierre persistente y repetición desde Ayuda; foco clicable y movimiento reducido.
- PWA: evento disponible, aceptado, cancelado, instalación completada, standalone, instrucciones iOS y descarte. No considerar comprobada la instalación física mediante simulación del evento.
- Cierre: checks específicos, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm format:check`; capturas móvil y escritorio. Registrar resultados reales y pendientes físicos.

## Plan de implementación

Ejecutar de forma secuencial en checkout aislado. Aplicar `superpowers:executing-plans` al comenzar.

- [x] Catálogo único: `src/entities/catalog/model/store.ts`, su adaptador `api/firestore.ts`, `src/pages/catalogs/*`, selectores en páginas de presupuesto/plantilla, rutas y navegación. Primero tests fallidos de consolidación/reintento e inicialización; después implementación y emuladores. Actualizar `docs/firebase.md` y `docs/state-and-cache.md`.
- [x] Consulta de tarifas: helper puro de normalización/orden con tests de tildes, descripción y categoría; integrar en `src/features/budget-editor/ui/CatalogSelector.tsx` y editor del catálogo. Verificar teclado y aplicación sin cambiar cantidad.
- [x] Ajustes visuales: tarjetas de listados, `src/pages/budget-detail/components/SaveTemplateButton.tsx`, CSS y componentes existentes. Verificar a 320/390 px y escritorio con nombres largos y error al guardar. Actualizar `docs/styles-and-responsive.md`.
- [x] Instalación: captura temprana en `src/app/pwa.ts`, aviso en componente independiente integrado con la shell. Tests de ciclo de evento/standalone y E2E de descarte e instrucciones. No mezclar estados de instalación con actualización en `PwaStatus`.
- [x] Asistente: nueva feature de estructura con modelo puro de selección y ranking; reutilizar edición atómica del store vigente si existe o añadir una operación acotada con tests. Integración sólo en presupuesto nuevo. Tests de snapshot inválido, cancelar, doble confirmar y conservación de metadatos; E2E de vuelta al editor y guardado.
- [x] Verificación global y revisión del diff; actualizar `docs/architecture.md`, `docs/plan.md` y esta spec con comandos ejecutados y pendientes. No afirmar instalación física, merge o publicación sin realizarlos.

## Riesgos que debe cubrir la revisión

Inicialización simultánea en dos pestañas; interrupción entre guardar y borrar catálogos; referencias antiguas; campos de cantidad vacíos tratados accidentalmente como válidos; eventos PWA previos al montaje de shell. Cada caso pertenece a los tests del bloque correspondiente.

## Entrega y evidencias

Rama `codex/bg008-catalog`, worktree `/Users/srebuelta/.codex/worktrees/bg008-catalog/renovation-budget-generator`, base `699b935`. La versión anterior y la ampliación se publicaron para prueba. No se han fusionado ramas ni borrado datos remotos.

Verificación: `pnpm lint`, `pnpm test` (45), `pnpm test:integration` (14 pruebas Firestore y 19 E2E), `pnpm format:check` correctos. El build de la suite usa exclusivamente el proyecto demo de emuladores; build normal de cierre correcto (PWA `d0b3ddd6467b6797`). El detector de Impeccable devuelve `[]` en los componentes modificados. Capturas `docs/testing-evidence/bg008-*` revisadas en escritorio y móvil (320/390 px); matriz general existente incluye 430/768 px.

La revisión independiente no encontró bloqueantes. Se reprodujo y corrigió su observación de limpieza legacy interrumpida: ahora se detectan restos legacy también cuando el destino ya existe; test de reintento RED→GREEN. Coste asumido: una consulta legacy adicional por carga de sesión. Se conservan los tests previos de agrupación de escrituras y cambio de cuenta.

La integración confirma rutas antiguas redirigidas, edición/recarga y separación entre cuentas, referencia histórica a un catálogo retirado, orden de resultados y búsqueda sin tildes, aplicación de tarifas sin cambiar medición, formulario de plantilla a 320 px, cancelación/retroceso del asistente, guardado con cantidades pendientes y bloqueo de PDF, recuperación del documento y sugerencias del historial. El evento de instalación se simula en las pruebas: falta comprobar la instalación real y los insets/teclado en Safari y PWA de dispositivos físicos.

Ampliación Partidas/Conceptos (17-10-2026): esta revisión anida conceptos bajo la partida del catálogo, usa sus IDs en selección y ranking del asistente, y adapta snapshots históricos sin reescritura masiva. Ver `docs/superpowers/specs/2026-10-17-catalogo-partidas-conceptos-design.md`. Checks: 52 unitarias, 16 reglas y 21 E2E en `demo-cimbra`, lint, build y formato correctos. Revisión independiente sin hallazgos. Desplegada sólo a Hosting el 17-10-2026 en https://budgenerator.web.app, sin fusionar ni publicar reglas; HTML y service worker coinciden con el build. Prueba física PWA pendiente.

Ajuste y publicación (17-10-2026): footer común eliminado; importador `/catalog` con búsqueda sin tildes y vista previa para los 19 oficios especializados disponibles. Importación categorizada, repetible sin duplicados, conserva conceptos y tarifas existentes y mantiene alta manual. Evidencia: `docs/testing-evidence/bg008-trade-import-desktop.png` y `bg008-trade-import-mobile.png`. Verificados previamente 56 unitarios, 16 reglas, 25 E2E, lint y formato; `pnpm firebase:deploy` volvió a generar el build normal (PWA `0b60a78045085d16`) y publicó sólo Hosting en https://budgenerator.web.app. HTML y service worker remotos coinciden byte a byte con `dist`; sin merge, cambios de reglas ni modificaciones de datos. Prueba física PWA pendiente.

Ajuste y publicación final (18-10-2026): importación selectiva por categoría/partida/concepto y tour de bienvenida para nuevos registros con repetición desde Ayuda. Verificados tras el merge: 60 unitarios, 16 reglas, 27 E2E en `demo-cimbra`, lint, build, formato y detector Impeccable sin hallazgos. Capturas responsive de importador y guía bajo `docs/testing-evidence/bg008-category-import-*` y `bg008-welcome-tour-*`. Integrado en `main` local y remoto y desplegado sólo a Hosting, PWA `b0f3ecf6be0ff903`; HTML y service worker remotos coinciden con `dist`. Sin cambios de reglas ni datos. BG-008 queda cerrado; la comprobación PWA física es un seguimiento opcional, no bloqueante.

Extensión de catálogo general para BG-009 (18-10-2026, local): añade la base común simplificada a las 19 especializadas y la usa al inicializar cuentas nuevas. No modifica catálogos guardados ni se ha desplegado.

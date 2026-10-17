# BG-007 — Plan de ejecución y registro

Spec vinculante: `BG-007-design-ux-consistency.md`. Ejecución autorizada por el usuario el 16-10-2026. Implementación inline, manteniendo revisión independiente final. Sin nuevas dependencias, proveedores de IA, cambios de reglas ni producción.

## Inventario (.0)

- `PageLayout` añade por defecto un retorno redundante; cabeceras distintas en cada página. `BudgetHeader` contiene el h1 del documento impreso; se mantendrá sólo para impresión al introducir el header común de pantalla.
- `EditableRow` tiene select y number con estilos distintos. `Modal` concentra dialog, foco, Escape y bloqueo del fondo; conservar su comportamiento y retirar sólo el outline del contenedor.
- `AppShell` contiene sidebar, cuenta móvil y tabbar; el logo vive en profile. La tabbar seguirá con cuatro destinos, y Ayuda se añadirá a sidebar/menú de cuenta.
- Listas: presupuestos (`BudgetsPage`), catálogos (`CatalogsPage`), plantillas (`TemplatesPage`). Borrar/seleccionar se delegará a stores existentes y a `ConfirmModal`, sin introducir propiedades default nuevas.
- Baseline: 23 unitarias correctas. Capturas previas versionadas en `docs/testing-evidence`.

## Pasos y contratos

- [x] .0 Reconciliar specs remotas, registrar BG-007 como prioridad y preservar el prototipo BG-006 fuera de este checkout.
- [x] .1 `PageHeader({eyebrow,title,description,actions?,backTo?,backLabel?})`, `BackButton({to,label})` y skeleton de header en shared/ui. Adoptar en todas las páginas con shell; login y visor mantienen identidad. Tests browser: un h1, misma jerarquía, sin retorno en raíces; hijas retornan al padre por ruta directa y conservan bloqueos de draft.
- [x] .2 Altura 44 px en inputs de línea, CTA de plantilla visible en móvil, dialog sin outline accidental; tokens de estados y foco. Tests browser: medidas iguales, edición decimal intacta, foco visible y retorno de modal.
- [x] .3 `CompanyAvatar({name,logo?})`: contain y fallback por error; tabbar flotante con fondo sólido y blur sólo bajo @supports, safe-area y espacio de contenido. Tests: logo ancho/fallido, 320 px, teclado y reduced-motion.
- [x] .4 `SwipeActions({label,children,actions,openDirection,onReveal,disabled?})`; `SwipeDirection = left|right|null`. Umbral 56 px, preferir eje vertical, sólo pointer touch/pen, nada se elimina por deslizar. Alternativa de menú visible y teclado. Integrar listas y callbacks existentes; estado de reveal exclusivo por lista, cerrar al salir o actuar en otra fila. Tests: vertical no revela; izquierda confirma; derecha sólo catálogo; predeterminado persiste al recargar; error recuperable.
- [x] .5 `/help`, contenido local por temas y enlaces reales; `InfoPopover({label,children})` con API nativa popover, tap/teclado/Escape y cierre exterior. Integrar aclaraciones de catálogo, unidades y ajustes/IVA. No describir IA futura. Tests: rutas, acordeones, links, popover y retorno de foco.
- [x] .6 QA: desktop y 320/390/430 px, capturas agrupadas, suites completas, revisión independiente y documentación de contratos/resultados. Registrar límites físicos de Safari/PWA.

## Riesgos y revisión

Protección de drafts al volver desde URL directa; swipe no debe activar navegación ni bloquear scroll; alternativas de teclado siempre accesibles; safe-area/tabbar no deben tapar CTA; logos fallidos no deben causar bucles; popover/modal no deben perder foco. Importe, IVA, guardado, cuotas, publicación y PDF conservan sus contratos.

## Registro

Inicio: copia aislada de origin/main (c475410), 23 unitarias correctas. El checkout original y su código de BG-006 permanecen preservados. La reconciliación de docs también se refleja allí; no se sustituyó su código por el del worktree.


## Verificación y decisiones de cierre

- `pnpm test`: 24 pruebas correctas, incluida clasificación de gestos deliberados frente a desplazamiento vertical, diagonales y movimientos cortos.
- `pnpm test:integration`: 12 pruebas de reglas y 15 de navegador correctas. Ocho recorridos nuevos cubren cabeceras/rutas/guard de plantillas, altura de controles, modal/foco, ayuda y popover, logo apaisado/fallido, swipe+predeterminado persistido, eventos touch nativos de Chromium y matriz visual (algunas comprobaciones se agrupan en un mismo recorrido).
- Lint, formato, TypeScript/build y diff sin errores. Sin cambios de dependencias, motor de cálculo, stores, reglas o servicios.
- Comparación visual en desktop/móvil: `docs/testing-evidence/bg007-*.png`. Segunda comprobación del listado móvil tras dar al nombre una fila completa para evitar que el menú de acciones lo comprima.
- Revisión independiente: sin bloqueantes confirmados. Se añadió prueba nativa de touch porque `dispatchEvent` por sí solo no verifica scroll ni captura real del puntero.
- Se mantuvieron tipografía/paleta existentes. El detector no presenta hallazgos; excepción específica Fraunces/index.css documentada en `.impeccable/config.json`.
- Las acciones de listado invocan stores actuales; los errores mantienen confirmación/estado recuperable y no se introduce default en presupuestos ni plantillas. Ayuda y popover usan contenido local y APIs nativas, sin dependencias nuevas.
- El popover se construye con contenido de frase para poder incluirse en aclaraciones dentro de párrafos sin anidación HTML inválida.

Ruling: se conserva el código adelantado de BG-006 en el checkout original y se trabaja BG-007 desde main remoto en un worktree separado; así no se mezcla el prototipo con la entrega UX. Coste si se cambia esta decisión: integrar posteriormente los puntos compartidos del editor/CSS, con pruebas de regresión.

Fases implementadas y comprobadas localmente. El usuario autorizó merge y despliegue el 16-10-2026. Commit fe20837 fusionado por fast-forward en main local y publicado en Hosting. El push fue rechazado con 403 para samuelrebueltainditex; no se creó PR ni se fusionó main remoto. Sin despliegue de reglas. No se considera realizado el QA físico de Safari/PWA (teclado, safe-area y gesto real en dispositivos); Chromium emulado no lo sustituye. La generación IA permanece pendiente.

Se verificaron también cuota agotada y catálogo inexistente: conservan PageHeader, retorno al padre y bloqueo de creación, sin cambiar reglas del plan. El test reprodujo primero la ausencia de cabecera.

Publicación 16-10-2026: `pnpm firebase:deploy` correcto para budgenerator, PWA `5d1b54b8e6aaddd5`. HTML y sw.js verificados por comparación binaria con build local. Lint, formato, 24 unitarias, 12 reglas, 15 E2E y build correctos antes de integrar; 24 unitarias repetidas tras merge. QA físico y push remoto pendientes.

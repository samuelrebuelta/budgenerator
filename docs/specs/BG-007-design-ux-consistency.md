# BG-007 — Mejoras de diseño y experiencia de usuario (SDD)
Estado: En revisión (implementación local) | Prioridad: Alta | Fecha: 2026-10-15
Autorización de ejecución: solicitud del usuario del 16-10-2026 de priorizar e implementar BG-007. No autoriza merge ni despliegue. Plan por fases y evidencia en `BG-007-execution.md`.

## Objetivo
Conseguir una UI más compacta, coherente y accesible en desktop y móvil/PWA. Mantener los flujos de negocio, arquitectura FSD, Tailwind CSS 4 y los tokens de marca actuales. Inspiración Liquid Glass solo para navegación móvil, con fallback legible.

## Evidencia del repositorio
- `src/app/router.tsx`: raíces `/budgets`, `/catalogs`, `/templates`, `/profile`, `/account`, `/admin`; hijas `/budget/:budgetId`, `/catalogs/:catalogId`, `/templates/:templateId`, `/account/password`. `/login` y `/shared/:token` son independientes.
- `src/pages/catalogs/CatalogsPage.tsx`: patrón `page-heading` con eyebrow, título, descripción y CTA etiquetado.
- `src/pages/template-detail/TemplateDetailPage.tsx`: 'Volver a plantillas' usa padding superior en móvil y margen inferior; sustituir por un encabezado coherente y reducir espacio.
- `docs/styles-and-responsive.md`: tabbar móvil hasta 800 px; editor en cards bajo 640 px; dialogs nativos y foco visible, respetar `prefers-reduced-motion`.
- `docs/sdd-plan.md` ya trata skeletons, textos publicitarios, duplicidad menú escritorio y sincronización; no revertir.
- `docs/specs/BG-006-ai-budget-generation.md` describe IA futura: mantener fuera de estas FAQ hasta que exista realmente.

## Requisitos verificables

### R01 — Eliminar retornos redundantes
Eliminar todos los enlaces 'Volver a presupuestos' de pantallas cuyo destino raíz está disponible en tabs o menú. Mantener rutas necesarias para páginas hijas, errores o visualizadores independientes. Auditar JSX, traducciones y tests sin eliminar navegación programática tras guardar.
**Aceptación:** ninguna página principal tiene botón volver; se llega a Presupuestos desde navegación global.

### R02 — PageHeader unificado
Extraer componente reutilizable `PageHeader({eyebrow,title,description,actions,backTo?})`, tomando como referencia la home y el patrón existente de catálogos. Un solo h1, tamaño del título ligeramente menor que el actual de home, descripción breve, espaciados horizontales y verticales consistentes en TODAS las páginas con shell. Login y /shared mantienen composición propia. Layout responsivo, acciones envolventes sin truncar.
**Aceptación:** todas las secciones y rutas hijas utilizan la misma jerarquía; no hay cambios de altura bruscos en skeletons.

### R03 — Navegación de páginas hijas
En detalle de presupuesto, catálogo, plantilla y cambio de contraseña usar `BackButton` circular, chevron estilo iOS, 44x44 px mínimo, `aria-label`, foco/hover/pressed. Usar destino padre seguro como fallback si se accede por URL directa. Mantener bloqueos de borradores sin guardar. Reducir margen superior del retorno en nueva plantilla.
**Aceptación:** volver es predecible desde enlace directo y no descarta cambios sin confirmación.

### R04 — Inputs de partidas
Unificar altura de unidad (UD), cantidad y precio, bordes, padding y alineación por tokens/componentes comunes tanto en tablas como cards. Sin cambiar tipos de unidad, parseo numérico, importes ni cálculos.
**Aceptación:** controles presentan el mismo alto y baseline; edición numérica funciona en móvil/desktop.

### R05 — Avatar de empresa
En el badge superior derecho, si existe logo de empresa mostrarlo sin deformación (`object-fit: contain`); si no existe o falla la carga, inicial existente. Conservar menú de usuario, tamaños táctiles y accesibilidad. No modificar persistencia o subida de logo.
**Aceptación:** logos cuadrados y apaisados se ven correctamente, con fallback estable.

### R06 — Outline de modales
Eliminar el outline visual accidental del contenedor modal nativo al abrir; NO quitar foco visible de elementos interactivos ni eliminar gestión de foco, Escape, retorno al disparador, bloqueo de fondo y cierre actual.
**Aceptación:** panel sin anillo accidental al abrir, recorrido de tabulación visible y accesible.

### R07 — Estados interactivos
Consolidar tokens para hover, active/pressed, focus-visible, selected, disabled, pending/loading en Button, icon button, filas navegables, menús, tarjetas y enlaces. Sin layout shift ni animaciones fuertes; `prefers-reduced-motion`, contraste y ausencia de hover en táctil.
**Aceptación:** los controles muestran estados coherentes y teclado siempre tiene indicador de foco.

### R08 — SwipeActions en listados
En móvil, deslizar izquierda revela acción de eliminar y deslizar derecha revela 'Establecer predeterminado' SOLO cuando la entidad soporte tal propiedad (ej. catálogos). No introducir default en presupuestos/plantillas. No ejecutar borrado de inmediato: botón de revelado + confirmación cuando corresponda. Reutilizar acciones de stores actuales; informar errores, mantener estado consistente y cerrar acciones al interactuar en otra fila. Umbral robusto que no colisione con scroll vertical, taps o apertura de detalle. Mantener alternativa mediante botón/menú accesible desde desktop, móvil, teclado y lector de pantalla.
**Aceptación:** swipe vertical no dispara acciones; activar catálogo refleja selección persistida; eliminar exige confirmación y soporta fallos; sin botón default donde no aplica.

### R09 — Crear plantilla
Sustituir botón aislado '+' por botón etiquetado con icono y estilos/posición consistentes con el CTA 'Crear catálogo' existente, también en estado vacío.
**Aceptación:** 'Crear plantilla' visible y comprensible; conserva creación/navegación actuales.

### R10 — Ayuda y FAQ
Crear `/help` como ruta interna accesible desde menú lateral y menú móvil, con `PageHeader`. Organizar en: Primeros pasos; Empresa y perfil; Catálogos (crear, tarifas, predeterminado); Plantillas (crear, editar, usar); Presupuestos (crear, editar, exportar/compartir solo si realmente existe); Cuenta y acceso; Problemas frecuentes. Cada tema tendrá explicación en lenguaje sencillo, 1–4 pasos y enlace directo a pantalla/acción real. Acordeones accesibles; contenido local versionado sin CMS ni backend; búsqueda local solo si volumen lo justifica. Comprobar todos los textos contra flujos existentes, no documentar IA aún no implementada.
**Aceptación:** un usuario nuevo puede seguir instrucciones reales y llegar a la función descrita; navegación y lectura por teclado correctas.

### R11 — Información contextual
Incorporar `InfoPopover` cuando aporte aclaración: catálogo predeterminado, unidades, plantillas, ajustes/IVA y otros conceptos complejos comprobados. Texto concreto (preferentemente una o dos frases), icono discreto con etiqueta accesible; apertura por tap, clic y teclado; Escape/cierre fuera; evitar tooltip exclusivamente hover. No saturar páginas.
**Aceptación:** las aclaraciones pueden descubrirse en móvil y con lector de pantalla.

### R12 — Tabbar flotante
Transformar tabbar móvil en superficie flotante con translucidez moderada, blur progresivo si es compatible, borde suave, fondo sólido de fallback y estados activos contrastados; respetar identidad existente sin copiar literalmente Apple. Incluir safe-area de iPhone, padding de contenido inferior y compatibilidad teclado/zoom; escritorio conserva sidebar actual.
**Aceptación:** ni contenido ni botones quedan bajo la tabbar, sin jitter, solapamientos ni pérdida de contraste en iOS PWA/Safari y Android.

## Ejecución SDD (una PR por fase)
| Fase | Entregable | Dependencias |
| --- | --- | --- |
| BG-007.0 | Inventario de páginas, componentes, enlaces de retorno, estados, screenshots baseline y tokens | Ninguna |
| BG-007.1 | PageHeader, BackButton y eliminación de enlaces redundantes; margen de plantilla | .0 |
| BG-007.2 | Inputs UD/Cant./Precio, CTA plantilla, dialog outline y estados interactivos | .0 |
| BG-007.3 | Badge con logo y tabbar flotante, responsive/fallback | .1 + .2 |
| BG-007.4 | SwipeActions en listados pertinentes con alternativas accesibles | .2 |
| BG-007.5 | Centro de ayuda, FAQ e InfoPopover | .1 |
| BG-007.6 | QA, capturas, pruebas de regresión y actualización documental | .1–.5 |

Las fases .3, .4 y .5 podrán paralelizarse evitando ediciones conflictivas del layout y CSS global. Cada PR debe incluir antes/después, límites de alcance, pruebas y rollback simple. No auto-merge ni despliegue.

## Pruebas obligatorias
- Ejecutar lint, typecheck, build y suites unitarias/e2e siguiendo scripts reales del repositorio.
- E2E de tabs, rutas directas, volver seguro y bloqueo por cambios sin guardar.
- Teclado: foco visible, Escape/restauración de foco modal, labels de BackButton, InfoPopover y alternativas de swipe.
- Mobile: scroll vertical vs swipe horizontal, confirmación de borrado, selección de catálogo predeterminado y recuperación de errores; tabbar con safe-area y teclado abierto.
- Comparación visual en 320–430 px, tablet y desktop; datos de prueba largos, vacíos, skeletons, errores, formularios, logos fallidos y navegación en PWA.
- Sin regresión en cálculo, estado de sesión, guardado, impresión/PDF, permisos ni reglas Firestore.

## Definition of Done
R01–R12 aceptados; capturas antes/después y pruebas adjuntas; sin regresión ni nuevas dependencias pesadas; actualizar `docs/styles-and-responsive.md`, traducciones y documentación de ayuda en la fase final. Sin cambios de datos, facturación, backend ni lógica de presupuestos.


## Resultado local del 16 de octubre

R01–R12 implementados en la copia aislada `feat/bg-007-design-ux`; registro de ejecución y comprobaciones en `BG-007-execution.md`. La revisión estática independiente no detectó bloqueantes. Siguen pendientes revisión de usuario, QA físico Safari/PWA y publicación autorizada. Entrega fe20837 fusionada en main local y desplegada en Hosting el 16-10-2026. Push/PR/merge remoto pendientes por rechazo 403 de GitHub; QA físico pendiente.

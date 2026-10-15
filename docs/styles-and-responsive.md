# Estilos y responsive

budgenerator utiliza Tailwind CSS 4 con el plugin de Vite y tokens en index.css. La identidad visual se documenta en design-proposal.md: petróleo, cal, papel y terracota; Manrope para UI y Fraunces para titulares. Ambas fuentes son locales.

La shell tiene navegación lateral en escritorio y navegación inferior bajo 800 px. La cuenta, logout y administración siguen disponibles desde el menú superior en móvil. El panel usa una tarjeta completa para el valor monetario en móvil, evitando recortar importes. El editor conserva tabla en escritorio y cards bajo el breakpoint sm de Tailwind (640 px).

Button, Input y otros controles proporcionan alturas táctiles cómodas. EditableRow ofrece nombres accesibles y edición decimal. El foco visible utiliza terracota; se respeta prefers-reduced-motion. Los modales se implementan con dialog nativo para foco, Escape e inercia del fondo y muestran errores de operaciones asíncronas.

Las secciones usan grid-template-rows para colapsar; sus preferencias se recuerdan por documento. Las páginas de presupuesto se montan por ID para no reutilizar el estado de una fila anterior. La impresión del navegador oculta shell, navegación, botones y márgenes de beneficio. El PDF de jsPDF tiene su propio layout independiente.

Las capturas de escritorio y móvil se generan con datos ficticios en la suite de navegador. Además del viewport y la ausencia de desbordamiento horizontal, revisar visualmente importes largos, foco y navegación con teclado al introducir cambios nuevos.

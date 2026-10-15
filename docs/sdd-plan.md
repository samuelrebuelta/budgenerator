# Plan SDD: observaciones de interfaz

Actualizado el 15 de octubre de 2026 a partir de las observaciones de revisión del diseño.

| Observación | Decisión aplicada | Criterio de aceptación |
| --- | --- | --- |
| Sustituir la pantalla de carga por skeletons en todas las páginas | El arranque de sesión y los cambios de ruta muestran una estructura de página. Plantillas y el presupuesto público también tienen placeholders; presupuestos, catálogos, detalle, perfil y administración ya los usaban. | Ninguna carga de página muestra un spinner o un texto aislado. Tras 12 s se ofrece reintentar; los errores conservan su mensaje y acción. |
| Quitar las frases publicitarias | Cabecera, lateral, pie, login, resumen, estados vacíos y avisos usan títulos o instrucciones concretas. | Los textos explican datos o acciones sin eslóganes. |
| Evitar controles de cuenta duplicados en escritorio | Administración, Mi cuenta y Cerrar sesión se mantienen en el lateral. El botón de cuenta de la cabecera se muestra solo a 800 px o menos. | En escritorio hay una sola ruta visible a cada acción; en móvil el menú de cuenta sigue accesible. |
| Revisar el indicador «Al día» | El estado de sincronización solo se muestra durante un guardado pendiente o ante un fallo recuperable. | El usuario ve «Guardando…» o «Reintentar guardado» cuando corresponde, sin una confirmación permanente ambigua. |

La comprobación automatizada incluye lint, TypeScript, build, unitarias, reglas de Firestore y recorridos de navegador con emuladores. La revisión visual en dispositivos físicos queda como validación de publicación.

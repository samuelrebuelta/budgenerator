# Exportación PDF

La exportación utiliza jsPDF en cliente y A4 vertical. El CSS print del navegador es una vía de impresión separada; el botón Exportar PDF no usa window.print().

`shared/ui/ExportPdfButton.tsx` abre una ventana dentro del gesto del usuario, importa el generador dinámicamente y espera la generación. Si falla, cierra la ventana y muestra el error. Si no hay ventana disponible, jsPDF descarga el documento.

`shared/lib/pdf.ts` expone un constructor de documento testeable y la salida de navegador. Comparte los cálculos de líneas, IVA, total, descuentos y precios ajustados con el resto de la aplicación. El documento público no contiene costes. El perfil normaliza los logos a PNG y el PDF limita tanto ancho como alto, conservando la proporción.

Las descripciones se dividen en líneas y las filas largas se continúan en otra página. Se repite la cabecera de partida y columnas y se numeran todas las páginas. Los bordes no dependen de una coordenada guardada en una página anterior. Los Object URLs se liberan después de permitir la apertura.

La validación pide cliente y conceptos completos con cantidad positiva; precio cero es válido. No se eliminan filas incompletas silenciosamente del presupuesto. La entrega incluye pruebas del constructor con documentos largos y verificación visual de páginas renderizadas mediante Poppler, además de una exportación desde el navegador con comprobación de bytes PDF.

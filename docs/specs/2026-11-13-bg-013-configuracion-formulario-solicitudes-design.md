# BG-013 — Configuración más fácil del formulario de solicitudes

Estado: aprobado

Fecha: 2026-11-13. Origen: prueba de uso del estimador público del 13-11-2026.

## Objetivo

Que un profesional sin web pueda publicar su formulario de solicitudes en pocos minutos y compartirlo fuera de una web, sin perder lo configurado y sin romper el enlace que ya repartió.

## Alcance y exclusiones

- Incluye:
  - Requisitos al principio del asistente (email verificado, nombre de empresa y aviso de privacidad), completables sin salir y avisando de todos a la vez.
  - Borrador de estancias y precios en `sessionStorage`, que sobrevive a recargar y a ir a Mi empresa. Mi empresa vuelve al estimador si se abrió desde él.
  - Errores concretos por estancia y campo.
  - Precios orientativos por estancia y un ejemplo de horquilla con una superficie típica.
  - Pausar y reanudar el formulario manteniendo la URL; confirmar antes de revocar.
  - URL corta estable por empresa (`/p/{slug}`) que sobrevive a revocar y volver a publicar. Si no hay formulario activo, muestra el nombre y el contacto autorizado de la empresa.
  - Kit para compartir: copiar, QR descargable, WhatsApp, compartir del sistema y botón HTML para la web.
  - Aviso de privacidad alojado (`/aviso-privacidad/{id}`) para quien no tiene web, generado con los datos de la empresa.
- No incluye: precio propio para reforma integral, presupuesto con capítulos desde la solicitud, estados de solicitud, fotos ni personalización de la URL corta.

## Criterios de aceptación

- [ ] Un propietario nuevo ve los tres requisitos antes de elegir estancias y puede completar nombre y aviso de privacidad sin salir.
- [ ] Recargar a mitad del asistente conserva estancias, precios y paso.
- [ ] Cada error de precio nombra la estancia y el problema.
- [ ] Pausar deja el formulario sin aceptar estimaciones ni solicitudes y muestra el contacto; reanudar lo reactiva con la misma URL.
- [ ] Revocar pide confirmación y explica que la URL dejará de funcionar.
- [ ] La URL corta abre el formulario activo y sigue funcionando tras revocar y volver a publicar.
- [ ] El aviso alojado muestra responsable, finalidad, base legal, conservación, destinatarios y derechos con los datos de la empresa.
- [ ] Borrar la cuenta elimina URL corta y aviso alojado; la exportación los incluye.

## Riesgos

- El texto del aviso alojado es un modelo: necesita revisión legal antes de abrir el registro público.
- El slug se deriva del nombre de empresa; si cambia el nombre, la URL corta no cambia.
- Pausa y URL corta añaden lecturas públicas; pasan por los mismos guardas anti-abuso que el resto del estimador.

## Tests

- Unitarios: slug, errores por estancia, precios orientativos y borrador.
- Reglas: `publicPrivacyNotices` solo lectura individual; `publicQuoteSlugs` cerrado.
- Integración (Functions): pausa, URL corta, aviso alojado, borrado y exportación de cuenta.
- E2E: los existentes del estimador; prueba manual en navegador del recorrido completo.

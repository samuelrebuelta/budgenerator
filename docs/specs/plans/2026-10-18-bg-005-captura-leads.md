# Plan — BG-005: captura y gestión de leads

> Implementación local aprobada por el usuario el 18-10-2026. Sin despliegue ni datos reales.

## Alcance

Ampliar el estimador público existente para guardar solicitudes con nombre, email, teléfono y respuestas de reforma; mostrar y borrar leads desde Mi empresa; y permitir iniciar y guardar un borrador de presupuesto relacionado con un lead. La horquilla se vuelve a calcular en Functions con el catálogo actual. No se generan líneas de presupuesto automáticamente ni se convierte la horquilla orientativa en precio final.

Los leads permanecen hasta el borrado manual. `Vivienda completa` es mutuamente excluyente con las demás estancias. Cada enlace necesita una URL HTTPS de privacidad para publicar/capturar; un enlace ya activo sin URL sigue calculando sin pedir contacto ni guardar datos.

## Secuencia

1. **Contratos y pruebas fallidas.** Añadir tipos para privacidad pública, contacto, lead, idempotencia y enlace lead/presupuesto. Escribir primero pruebas de validación/horquilla, Firestore Rules, y E2E del envío público, bandeja, borrado y conversión.
2. **Configuración privada.** Añadir URL de privacidad HTTPS al perfil de empresa, controles de validación en UI y Functions, exigirla al publicar tokens nuevos y devolver al formulario público solo URL validada y estado de captura habilitada.
3. **Envío seguro.** Añadir `submitPublicLead` en Functions. Validar token, contacto, consentimiento, límite de tamaño, selecciones disponibles e idempotency key; resolver propietario y volver a calcular contra el catálogo actual; guardar con Admin SDK en `users/{uid}/leads/{leadId}`. Limitar envíos a 10 por token por hora y dejar los documentos de límite sólo para servidor.
4. **Permisos Firestore.** Permitir lectura/listado y borrado sólo al propietario. Denegar creación del cliente y edición general. Permitir únicamente cambiar `budgetId` hacia un presupuesto de la misma cuenta. Añadir pruebas de aislamiento entre cuentas, acceso anónimo, alteración del lead y vínculo a presupuesto ajeno/inexistente.
5. **Formulario público.** Mantener la selección múltiple de estancias; vivienda completa desmarca/bloquea las otras. Recoger contacto y confirmación explícita solo cuando la captura esté habilitada. El botón calcula y guarda en una operación funcional idempotente; tras éxito muestra rango y confirmación. Para enlaces heredados sin privacidad, conservar la estimación y ocultar la recogida de datos personales.
6. **Bandeja de Mi empresa.** Crear lista ordenada por fecha con detalle de contacto, estancias, alcance, calidad, superficie y horquilla. Añadir contacto por teléfono/email, confirmación de borrado manual y estado/enlace del presupuesto relacionado. No exponer leads a otras cuentas.
7. **Presupuesto desde lead.** Añadir `sourceLeadId` al modelo de presupuesto y a su mapeo Firestore, sin incluirlo en el DTO público. `startDraftFromLead` usa una clave de borrador local propia, copia solo el nombre y conserva el resto en un panel de contexto de solo lectura. El guardado crea presupuesto, actualiza cuota y escribe `lead.budgetId` en la misma transacción. Respetar la cuota actual y conservar/reabrir el borrador normal si el usuario ya tenía uno. Si se borra un presupuesto vinculado, el lead permanece y puede originar otro.
8. **Docs y verificación.** Actualizar `docs/plan.md`, `docs/firebase.md`, `docs/architecture.md` y `docs/state-and-cache.md`. Ejecutar pruebas unitarias, integración de reglas y E2E con emuladores; luego lint, formato y builds de app/Functions. Revisar diff y secretos. No desplegar.
9. **Plazo y navegación de Solicitudes.** Añadir `startTiming` al contrato y validarlo estrictamente en la función. El formulario ofrece «Lo antes posible», «En 1–3 meses», «En 3–6 meses» y «Más adelante»; la bandeja y el contexto del presupuesto muestran la elección. La tab móvil final pasa a ser «Solicitudes» y Mi empresa se incorpora al menú de cuenta de cabecera. Cubrir envío/visualización y acceso desde navegación con E2E.

## Contratos de datos

Lead privado: versión de esquema, `{name,email,phone}`, selecciones validadas, horquilla en céntimos, EUR/sin IVA, fecha del servidor, timestamp de confirmación, snapshot de URL HTTPS y `budgetId` opcional. Sin dirección, texto libre, tarifa, coste, UID público ni caducidad.

El cliente genera una clave aleatoria por envío y reutiliza la misma clave al reintentar. Functions deduplica de forma transaccional y devuelve solo rango/confirmación; nunca el lead guardado ni UID/catalogo.

## Riesgos y decisiones ya tomadas

- La retención es manual, indefinida hasta borrado del titular.
- La horquilla no crea partidas ni precios en el presupuesto; la empresa debe preparar el presupuesto técnico.
- El límite 10/hora por token reduce envíos repetidos, pero no reemplaza App Check/CAPTCHA ni un control global de gasto. Documentar esa limitación antes de producción.
- Si falla el guardado del lead, no mostrar confirmación de éxito; si falla la conversión, la transacción no crea ni cuota ni relación parcial.

## Criterio de cierre

El mismo envío público almacena exactamente un lead en la cuenta resuelta por el token; el propietario puede consultarlo/borrarlo y crear desde él un borrador relacionado; otras identidades no acceden ni modifican datos. Suites y comandos ejecutados quedan registrados con resultados reales en `docs/plan.md`.

# BG-005 — Envío y gestión básica de leads

**Estado:** aprobada por el usuario el 18-10-2026, con conservación manual, selección múltiple de estancias y conversión a presupuesto. Implementada localmente; pendiente de despliegue explícito.

## Intención

Después de completar el formulario público de estimación, el cliente envía su nombre, email, teléfono y las respuestas sobre la reforma. La empresa puede abrir esa solicitud desde Mi empresa y contactar con contexto.

## Alcance

- El formulario pide nombre, email y teléfono, además de las selecciones de estancia, alcance, calidad, superficie y plazo de inicio. No pide dirección ni texto libre.
- El plazo de inicio es obligatorio y ofrece «Lo antes posible», «En 1–3 meses», «En 3–6 meses» y «Más adelante»; expresa preferencia del cliente, no duración ni compromiso de fecha.
- Un único envío explícito calcula la horquilla con el catálogo actual y crea el lead en la cuenta identificada por el token. La respuesta pública devuelve solo la horquilla y una confirmación, nunca el documento guardado, el UID ni el catálogo.
- El titular ve las solicitudes más recientes en una bandeja sencilla dentro de Mi empresa, con contacto, fecha, datos de reforma y horquilla. Puede llamar, escribir, borrar manualmente o crear un presupuesto desde una solicitud.
- Crear un presupuesto desde una solicitud abre un borrador con el nombre del cliente y referencia al lead. Un panel de contexto de solo lectura conserva visibles email, teléfono, respuestas y horquilla mientras se edita; esos datos no se duplican en el presupuesto ni se publican al compartirlo. No se inventan partidas ni se convierte la horquilla en un precio; la empresa añade y mide los conceptos reales en el editor.
- El borrador usa una clave local propia por lead para no confundirlo con otro borrador en curso. Respeta el límite de creación del plan. Al guardar, una transacción crea el presupuesto, actualiza el contador de presupuestos y enlaza `lead.budgetId`. Si después se borra ese presupuesto, el lead permanece y permite iniciar otro borrador; la bandeja indica que el presupuesto enlazado anterior ya no está disponible.
- No hay estados, asignaciones, notas, exportación, automatizaciones, CRM ni notificaciones.
- La casilla informa de que, al enviar, la empresa podrá contactar a la persona por esta solicitud concreta; no autoriza marketing. El envío guarda la fecha de aceptación y la URL del aviso que estaba visible. El texto legal final del aviso pertenece a cada empresa.
- La empresa configura una URL HTTPS de privacidad desde el perfil. Un enlace público que ya esté activo conserva el cálculo aunque falte esa URL, pero no acepta datos de contacto ni permite enviar un lead hasta configurarla. La publicación de enlaces nuevos requiere la URL.

## Flujo y datos

El cliente llama a una Cloud Function pública con el token, contacto, selecciones, plazo de inicio y confirmación. La función valida las entradas, resuelve el titular del token, vuelve a calcular la horquilla en el backend y crea un documento en `users/{uid}/leads/{leadId}` mediante Admin SDK. El documento contiene versión de esquema, nombre, email, teléfono, selecciones, plazo, horquilla en céntimos, moneda, fecha de creación, fecha de consentimiento y copia del enlace de privacidad usado en el envío. El envío es idempotente dentro de la petición para evitar duplicados por reintentos de red.

El navegador autenticado puede leer y borrar leads únicamente bajo su propio UID. No puede crearlos; el único creador es Cloud Functions. Durante la transacción de creación de presupuesto puede actualizar solo el vínculo `budgetId`, y solo hacia un presupuesto bajo el mismo UID. La operación de borrado es manual y no se borran leads por antigüedad ni al crear un presupuesto.

Los leads se conservan hasta que el titular los borre manualmente. No llevan `expiresAt` ni configuración TTL. No se usarán datos reales durante las pruebas locales.

## Privacidad y validación

- No se recoge dirección, documentos, archivos ni texto libre.
- El nombre, email y teléfono son obligatorios, según la petición del usuario; límites de longitud, email sintácticamente válido y teléfono validado en cliente y servidor. Se conserva el número escrito con sus espacios, paréntesis y prefijo opcional `+`; no se asume código de país ni se reescribe silenciosamente el número.
- La casilla de contacto es obligatoria y el backend solo acepta `true`; guarda su hora y la URL de privacidad HTTPS vigente.
- Una solicitud sin token activo, con consentimiento falso o con selecciones no disponibles no crea ningún lead.
- Se pueden seleccionar varias estancias. `Vivienda completa` incluye toda la vivienda y es incompatible con cualquier otra selección.
- Se permiten hasta 10 envíos de leads por token en una ventana móvil de una hora, además del límite actual de consultas de estimación. Es una contención básica de abuso, no una defensa global contra tráfico automatizado.
- El token público sigue siendo opaco y revocable. El límite existente de 20 operaciones por minuto se aplica por token válido y se comparte con lectura/cálculo; no mitiga ráfagas de tokens inválidos.

## Pendientes de decisión

- La URL concreta de privacidad se configura por empresa en Mi empresa y debe ser HTTPS.
- Antes de producción se confirmarán el plan y la región de Firebase.

La navegación principal coloca «Solicitudes» después de Presupuestos, Plantillas y Catálogo. «Mi empresa» se abre desde el menú superior, junto a Mi cuenta y Ayuda y guía.

## Criterios de aceptación

- Un visitante puede enviar contacto y respuestas y recibe la horquilla calculada; se almacena un solo lead bajo el propietario del token.
- El titular consulta los leads de su cuenta y puede borrarlos; otra cuenta, un usuario público y el cliente no pueden leerlos ni escribirlos en Firestore.
- Enlaces revocados, combinaciones obsoletas y envíos sin consentimiento no guardan información.
- Los leads permanecen hasta el borrado manual; no hay borrado TTL.
- El titular puede abrir desde un lead un borrador de presupuesto prellenado, guardarlo y regresar al lead relacionado.
- El plazo elegido se valida en servidor y aparece en la bandeja y en el contexto del presupuesto relacionado.
- Presupuesto, contador de cuota y vínculo al lead se guardan en una única transacción; no se crea un presupuesto duplicado por reintentos.
- Las pruebas usan exclusivamente datos sintéticos y emuladores; no se toca producción.

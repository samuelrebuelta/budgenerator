# BG-005 — Landings y solicitudes de presupuesto

**Estado:** diseño preparado; las decisiones operativas se concretarán al preparar la implementación. No autoriza publicar páginas ni activar un proveedor de IA.
**Fecha:** 2026-10-17.

## Intención

Ayudar a una empresa de reformas a tener una landing sencilla que pueda publicar y editar desde BudGenerator. La página debe convertir visitas en solicitudes de presupuesto: el visitante describe su reforma con un formulario breve, recibe una estimación orientativa basada en el catálogo de esa empresa y deja teléfono para que la empresa prepare la oferta final.

## Objetivos

- Generar con IA una primera versión editable a partir de los datos públicos de empresa y los servicios que elija.
- Permitir que la empresa cambie textos y datos, y añada/reordene fotos de trabajos.
- Publicar una landing móvil con un enlace claro al formulario de solicitud.
- Recibir solicitudes en el perfil de BudGenerator, con teléfono, estimación, datos enviados y estado básico de seguimiento.
- Calcular precios de forma determinista con las tarifas del catálogo configurado; la IA no decide mediciones ni precios.

## Propuesta de experiencia

1. En BudGenerator, la empresa crea una landing, selecciona los servicios que quiere mostrar y genera un borrador de textos. La IA devuelve contenido estructurado para una plantilla controlada (titular, descripción, servicios, galería, preguntas frecuentes y llamadas a la acción), nunca HTML o JavaScript ejecutable.
2. La empresa revisa y edita cada bloque, corrige datos, sube fotos y previsualiza escritorio/móvil. Nada se publica hasta pulsar **Publicar**.
3. BudGenerator asigna un slug y ofrece dos enlaces: la landing pública, por ejemplo `/c/{slug}`, y el formulario `/c/{slug}/solicitar-presupuesto`. La landing abre el formulario en BudGenerator mediante un CTA visible.
4. El visitante indica contacto, zona de la obra, tipo de reforma, alcance/estancias y tamaño aproximado que permita completar la estimación. Antes de enviar ve el uso de sus datos y acepta la política de privacidad aplicable.
5. El formulario muestra un rango orientativo, aclara que la empresa debe revisar medidas y alcance para preparar el presupuesto final, y guarda una solicitud privada en el perfil de BudGenerator. El usuario puede pulsar el teléfono para llamar, marcar la solicitud como nueva/contactada/cerrada y abrir su detalle.

Los nombres de rutas son propuestas; la página se alojaría inicialmente en BudGenerator/Firebase Hosting. Web Factory Lite continúa como producto independiente: el formulario puede enlazarse desde cualquier web externa, sin monorepo ni integración de código entre repositorios. Si se prefiere que la landing la publique Web Factory Lite/Cloudflare, sólo se compartirá el enlace del formulario y se deberá diseñar esa conexión por separado.

## Estimación vinculada al catálogo

El origen será el catálogo único `users/{uid}/tariffCatalogs/main-v1`, con partidas `CatalogPart` y conceptos embebidos. No se debe pedir al visitante que componga un presupuesto técnico. La empresa configurará servicios abstractos (por ejemplo, reforma de baño o pintura de vivienda), los vinculará mediante sus IDs a conceptos del catálogo y fijará cantidades mínimas/máximas por una o varias bandas de tamaño. El visitante elegirá servicio, zona y tamaño aproximado; las reglas transformarán esas respuestas en cantidades estimadas. Un servicio no se podrá publicar como estimable si no tiene mapeo y tarifa base suficientes.

El servidor calculará el mínimo y máximo con la tarifa de venta `basePrice` y la cantidad correspondiente; nunca usará ni expondrá el campo de coste interno `cost`. La propuesta no añade un porcentaje arbitrario de error: el rango procede de cantidades mínimas/máximas configuradas por la empresa. La política de ajuste, IVA y redondeo debe quedar definida antes de publicar. La empresa verá la base desglosada; el visitante verá sólo el rango no vinculante. Cada solicitud conserva una instantánea de mapeo y tarifas; cambios al catálogo no la reescriben.

## Datos y arquitectura propuestas

- Borrador privado de landing bajo la cuenta propietaria, con bloques estructurados, `slug`, versión y estado `draft/published/archived`.
- Documento público separado, por slug, con sólo contenido aprobado y datos de contacto autorizados; sin UID, precios internos, costes ni datos de solicitudes. Se podrá leer por slug, pero no listar ni escribir desde navegador anónimo.
- Fotos en Firebase Storage y metadatos en la landing. Aplicar reglas para que sólo el propietario gestione archivos, con tipos y tamaños limitados, y exponer públicamente sólo imágenes de una landing publicada.
- Solicitud en `users/{uid}/quoteRequests/{requestId}` con contacto, ubicación/alcance, consentimiento y su versión, fecha, estado, rango estimado y snapshot de catálogo. Sólo la empresa titular podrá leer/actualizarla.
- La generación de textos y el cálculo final pasan por Cloud Functions. La clave del proveedor de IA se guarda en Secret Manager. La escritura pública de solicitudes pasa por una función validada que resuelve el slug y crea el documento en nombre del titular; no se permite a visitantes escribir libremente en la ruta privada.
- Añadir controles contra abuso (App Check donde sea viable, honeypot, validación de campos y limitación de envíos), tamaño de payload y alertas de gasto. No enviar solicitudes ni datos personales de clientes a la IA.

Los documentos guardarán estados `nueva`, `contactada` o `cerrada`, no un pipeline de ventas. La lista de perfil tendrá búsqueda sencilla, teléfono clicable y detalle; no habrá automatizaciones, notas comerciales avanzadas ni campañas.

## Acceso comercial

La recomendación es incluir landing, formulario y solicitudes en BudGenerator Pro y dejar que Free gestione presupuestos, catálogos y plantillas según BG-004. La disponibilidad en Free se concretará al preparar la implementación.

Si se aprueba Pro como requisito, la propuesta es mantener publicación y recepción hasta el final del periodo pagado; al vencer, despublicar la landing y cerrar el formulario, pero conservar borrador e histórico de solicitudes en el perfil del dueño para consulta/edición. La bajada de plan no borraría datos. Borrar una landing sólo elimina su cara pública e imágenes; no elimina solicitudes asociadas. El plazo de retención y el borrado/exportación de solicitudes deben definirse antes de producción según la política de privacidad de la empresa.

## Criterios de aceptación

- Una persona puede generar, editar, previsualizar, publicar, despublicar y volver a publicar una landing sin que la IA cambie lo que no pidió.
- El público sólo ve la versión publicada y campos permitidos; no puede leer otros borradores, cuentas, tarifas privadas ni solicitudes.
- Cada estimación usa una configuración y tarifa del usuario identificables, muestra rango orientativo y conserva snapshot reproducible.
- La solicitud incluye teléfono y consentimiento, aparece sólo en el perfil dueño y el usuario puede contactar por teléfono y cambiar estado.
- Validar esquema/tamaño, enlaces, spam, doble envío, slug duplicado, archivo no permitido, borrado de landing con solicitudes previas y fallo del proveedor de IA.
- Rules y funciones se prueban en emuladores y con peticiones públicas de prueba; se define retención y borrado/exportación de datos antes de producción.

## No objetivos

Una web multipágina/CMS completo, dominio propio, ecommerce, reservas de citas, chat, integración de código con Web Factory Lite, precios generados por IA, presupuesto vinculante automático, CRM completo, notificaciones multicanal y marketing automatizado.

## Fases de producto

1. Definir formulario y mapeos de servicios a catálogo; acordar URL, publicación y retención.
2. Landing estructurada editable, galería, publicación/despublicación y accesibilidad.
3. Estimador determinista y endpoint de solicitudes con privacidad, abuso y reglas.
4. Asistencia IA para generar y regenerar bloques aprobados, con límites de coste y alternativa de edición manual si falla.
5. Lista de solicitudes, estado básico, contacto telefónico, borrado/retención y métricas operativas.

## Decisiones para concretar durante el plan técnico

- Confirmar si el módulo es exclusivo de Pro y cómo afecta una cancelación a páginas y solicitudes existentes.
- Confirmar hosting/URL de la landing: BudGenerator/Firebase Hosting (recomendación) o Web Factory Lite/Cloudflare con enlace externo al formulario.
- Definir servicios abstractos, preguntas mínimas, unidades/rangos y política de redondeo del estimador.
- Elegir proveedor de IA, región, presupuesto por generación y condiciones de privacidad.
- Definir límites de imágenes, textos legales/consentimiento, retención de leads, borrado y datos que se muestran en público.
- Resolver si el rango incluye IVA y cómo presenta ajustes/redondeo; no publicar un estimador hasta acordarlo.
- Definir qué hacer cuando el catálogo no tenga suficiente precio para estimar.
- Definir ejemplos concretos de servicios y bandas de tamaño para la primera versión; la propuesta es que cada empresa los configure y asigne sus conceptos y cantidades, en vez de depender de una fórmula generada por IA.

## Restricción de infraestructura

El checkout actual usa Firebase Auth, Firestore y Hosting, pero no Cloud Functions ni Storage. La propuesta incorpora Functions, Storage y reglas nuevas; requerirá emuladores, coste/plan de Firebase adecuado, configuración de secretos, política de abuso y revisión del presupuesto operativo antes de lanzar. No se desplegará ninguna función o IA durante la fase de diseño.

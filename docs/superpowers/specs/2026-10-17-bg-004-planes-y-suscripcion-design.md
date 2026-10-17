# BG-004 — Planes y suscripción BudGenerator Pro

**Estado:** diseño preparado; las decisiones operativas se concretarán al preparar la implementación. No autoriza cobros reales.
**Fecha:** 2026-10-17.

## Intención

Definir una oferta sencilla para que una empresa pueda probar BudGenerator y, cuando necesite crear más presupuestos, contratar un único plan de pago. La cuota debe controlar la creación de presupuestos sin limitar catálogos ni plantillas.

## Requisitos confirmados

- **Free:** máximo de 3 presupuestos.
- Catálogos y plantillas sin límites de cantidad.
- Un único plan de pago, mensual, por **19,99 € + IVA**.
- La suscripción se cobrará con Stripe.

## Propuesta de producto

Recomiendo el nombre **BudGenerator Pro**. “Pro” describe el plan profesional sin prometer capacidad ilimitada en todas las funciones; “Premium” es genérico y “Unlimited” podría inducir a pensar que no hay límites de ningún tipo. El precio se mostrará como **19,99 €/mes + IVA** y se cobrará en EUR con una recurrencia mensual.

La propuesta cubre suscripción mensual y autoservicio básico de pago/cancelación. No introduce planes anuales, periodos de prueba, cupones, facturación de las reformas de la empresa ni un sistema de administración comercial.

### Significado del límite gratuito

El código de este checkout cuenta `totalBudgetsCreated` de forma acumulada y borrar un presupuesto no devuelve cuota. Eso no queda decidido por la frase “límite de 3”. La recomendación de producto es permitir **hasta 3 presupuestos activos guardados a la vez** y liberar una plaza al borrarlos o convertirlos en proyecto. Un presupuesto convertido deja un snapshot de consulta dentro del proyecto y no se puede borrar ni editar desde el flujo normal. Así, una cuenta Free no agota permanentemente su cuota por proyectos ya aceptados. Tras una bajada de Pro, puede consultar y editar los presupuestos existentes, pero no crear otro hasta quedar por debajo del límite. Se concretará al iniciar la implementación. Catálogos y plantillas permanecen ilimitados con ambos planes.

## Experiencia esperada

1. Un usuario Free puede crear hasta el límite aprobado. Al intentar crear otro presupuesto, recibe una explicación breve y un acceso a contratar Pro; su borrador no se pierde.
2. El usuario autenticado inicia el pago en Stripe Checkout y vuelve a BudGenerator al completarse o cancelarse. La pantalla de cuenta muestra plan, estado y fecha del siguiente cambio relevante.
3. Desde la cuenta puede abrir el portal de cliente de Stripe para actualizar el medio de pago o cancelar.
4. Al cancelar, la cuenta conserva Pro hasta el fin del periodo pagado. Ante un impago, la propuesta es conservar Pro mientras Stripe reintenta el pago y degradar cuando Stripe termine la suscripción; no añadir una gracia extra después del fin. Los documentos existentes no se borran ni se vuelven inaccesibles al pasar a Free.

## Arquitectura y confianza

El código actual guarda `accountData.plan` (`free`/`premium`) y una fecha de vencimiento en Firestore. Las reglas de Firestore protegen esos campos frente a cambios del cliente y la creación de presupuestos ya tiene un contador transaccional y una cuota Free. No hay Functions ni Stripe en este checkout. La implementación debe conservar la decisión de que el cliente nunca pueda otorgarse acceso de pago.

Stripe será la fuente de verdad del pago. Cloud Functions autenticadas crearán Checkout y sesiones del portal; un endpoint de webhook verificará la firma de Stripe, procesará eventos idempotentemente y escribirá una proyección mínima de derechos en Firestore. La aplicación leerá esa proyección, pero no aceptará cambios de plan desde el navegador. Los identificadores y estado sensibles de Stripe quedarán en un documento privado de facturación; las reglas permitirán al titular leer sólo los campos de estado que necesita la interfaz y denegarán sus escrituras.

El acceso efectivo deberá considerar estado y fin del periodo, no sólo si existe un documento de suscripción. Como mínimo se diseñarán los eventos de checkout completado, cambio/cancelación de suscripción, pago de factura y fallo de pago. No se concederá acceso por la página de retorno de Checkout: esa navegación no sustituye al webhook confirmado.

La cuota Free se comprobará de forma atómica y del lado de confianza que ya impone Firestore Rules. Con la propuesta de límite simultáneo, se mantendrá un contador de presupuestos que todavía ocupan plaza y se actualizará en la misma operación que crear, borrar o convertir uno en proyecto; así se evita depender de consultas de cliente o de una cuenta de documentos que incluya proyectos históricos. Conservar borradores locales, plantillas y catálogos no consumirá cuota.

## Fiscalidad y operación

El precio acordado es antes de IVA. La configuración de Stripe deberá expresar impuestos exclusivos del precio y se validará con la configuración fiscal real de la empresa antes de abrir pagos; no se presupone que la activación de Stripe Tax resuelva por sí sola obligaciones de registro o facturación. Guardar secretos sólo en Secret Manager. Las Functions añaden facturación y requieren habilitar el plan de Firebase correspondiente; revisar coste, región, alertas y límites antes del despliegue.

Las cuentas `premium` existentes fueron asignadas manualmente por administración. La propuesta es conservarlas como concesiones administrativas explícitas separadas de la suscripción Stripe; una cancelación de Stripe no retiraría una concesión manual todavía vigente. No deben degradarse silenciosamente. La capacidad administrativa existente no se elimina en esta iniciativa.

## Criterios de aceptación

- Free puede crear exactamente el límite aprobado; la cuarta creación concurrente no lo puede saltar.
- Ni Free ni Pro tienen cuotas de catálogos o plantillas.
- El precio, la recurrencia y el tratamiento de impuestos se muestran de acuerdo con **19,99 €/mes + IVA**.
- Un retorno falso del navegador, un webhook repetido, atrasado o con firma inválida no concede ni revoca acceso incorrectamente.
- Cancelación, renovación, impago y vencimiento dejan derechos y mensajes coherentes; los documentos permanecen seguros y accesibles según la política aprobada.
- Un usuario no puede modificar plan, vencimiento ni datos de Stripe desde Firestore cliente.
- Hay pruebas unitarias de la máquina de estados y pruebas de reglas/emulador para la cuota y campos protegidos.

## Fuera de alcance

Facturar las reformas del usuario, CRM, contabilidad, planes por uso, cobros por catálogo/plantilla, suscripciones anuales, promociones y automatización de administración más allá de mantener derechos de acceso.

## Decisiones para concretar durante el plan técnico

- Límite de 3 simultáneo o acumulado y relación con proyectos convertidos (propuesta: simultáneo, y liberar plaza al convertir).
- Confirmar retención Pro durante los reintentos de Stripe, degradación al final de la suscripción y ausencia de gracia adicional.
- Confirmar que las concesiones `premium` manuales se conserven separadas y prevalezcan sobre Stripe.
- Qué política de reembolsos se comunicará; la propuesta inicial es no añadir trial ni gestión propia de reembolsos.
- Confirmación de configuración fiscal, factura/recibo y costes de Firebase Functions/Stripe antes de activar cobros.

## Referencias técnicas

- [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions) permite crear la sesión en servidor en modo `subscription`.
- [Stripe: webhooks para suscripciones](https://docs.stripe.com/billing/subscriptions/webhooks) describe la verificación de eventos y los cambios asíncronos de estado.
- [Stripe: impuestos exclusivos en suscripciones](https://docs.stripe.com/api/subscriptions/update) documenta `tax_behavior=exclusive` y el cálculo automático cuando se configura.
- [Firebase callable Functions](https://firebase.google.com/docs/functions/callable) pasa tokens de Auth/App Check disponibles a la función; [Firestore Rules](https://firebase.google.com/docs/firestore/security/overview) gobierna accesos del cliente, mientras el servidor se protege mediante IAM.

# BG-010 — Avisos push y email al recibir solicitudes

Estado: diseño propuesto y plan preparado, 18-10-2026. Solicitud del usuario: «añadir una feature con su plan para enviar notificaciones push y email cuando se recibe una solicitud». Esta entrega documenta; no autoriza implementación, envío real, contratación ni despliegue.

## Objetivo y alcance

Avisar al titular de una empresa cuando se crea una solicitud válida del estimador público BG-005. Canales independientes: email transaccional y push web/PWA en dispositivos activados. El aviso abre la solicitud dentro de la app autenticada. El lead sigue siendo la fuente de verdad; fallo de aviso no pierde ni invalida la solicitud.

Supuestos propuestos: destinatario = titular de la cuenta propietaria del lead; entrega a todos sus dispositivos habilitados. No se envía confirmación al visitante. Cada canal se activa expresamente y puede desactivarse por separado. No decidir aquí si pertenece a Free/Pro: depende de BG-004, sin cambiar permisos comerciales existentes.

Fuera de alcance: campañas, marketing, WhatsApp/SMS, equipos/múltiples destinatarios por empresa, recordatorios, IA y centro de notificaciones histórico general.

## Flujo y UX

1. Visitante envía el formulario; `submitPublicLead` valida y guarda el lead con el flujo transaccional/idempotente actual. Devuelve recibido sin esperar a proveedores de notificaciones.
2. Un trigger de creación de `users/{uid}/leads/{leadId}` prepara trabajos de entrega idempotentes. Modificar un lead o enlazar su presupuesto no genera avisos de nueva solicitud. No reenviar leads históricos al activar canales.
3. Email y push se procesan por separado. Cada aviso muestra «Nueva solicitud de presupuesto» y «Tienes una nueva solicitud en BudGenerator», sin datos de contacto, dirección ni detalles de la reforma en pantalla bloqueada o asunto/cuerpo de email. Botón «Ver solicitud».
4. Destino propio: `/profile/solicitudes?leadId=<id codificado>`. Añadir selección/enfoque del lead al cargar. Si falta sesión, iniciar sesión y continuar a esa ruta validada del mismo origen. Si se entra en otra cuenta o el lead se borró, mostrar estado seguro sin revelar datos ni entrar en bucle. Nunca usar el enlace público del estimador como enlace de gestión.

En «Mi cuenta → Notificaciones», añadir:
- Email: estado, dirección de cuenta mostrada en modo lectura y control de activación.
- Push: «Activar en este dispositivo», «Desactivar en este dispositivo», lista básica de dispositivos y revocación. El botón dispara el permiso del navegador; no pedirlo automáticamente al entrar.
- Estados diferenciados: desactivado, activo, permiso bloqueado, navegador no compatible y error recuperable. Denegación explica cómo cambiar permiso; no repetir prompts.
- Preferencia global de push y estado de cada dispositivo: activar globalmente no solicita permisos en otros dispositivos; sólo reciben los ya autorizados. Logout elimina/revoca la asociación del dispositivo actual antes de cambiar usuario; los pendientes de limpieza se reconcilian al volver a conectar. No prometer revocación de avisos ya enviados al sistema operativo.

Email usa la dirección actual verificada de Firebase Auth, leída en servidor; nunca el email de contacto del lead ni el perfil público editable. Si no está verificada, pedir verificación y mostrar el canal pendiente; no bloquear acceso a la app ni recepción de leads. Cambio de email invalida/revalida el destino antes del siguiente envío. No permitir destinos arbitrarios en MVP.

## Arquitectura propuesta

Reutilizar Functions v2 y Firebase Admin actuales. Push mediante Firebase Cloud Messaging; email mediante un adaptador de proveedor transaccional por seleccionar antes de implementar el envío real. Desarrollo y CI usan adaptadores falsos explícitos. Secretos sólo en servidor; la clave pública VAPID puede llegar al navegador. No añadir librería de notificaciones general ni proveedor de colas externo.

FCM se integra con el service worker **existente** `public/sw.js`, generado por `scripts/build-sw.mjs`; no registrar otro worker que sustituya el worker PWA. Verificar las APIs contra la versión Firebase instalada antes de implementar. HTTPS, permiso y soporte se detectan; no prometer compatibilidad universal. Prueba física obligatoria en Android y PWA instalada en iOS/Safari antes del rollout push. Primer plano usa un único aviso dentro de app; segundo plano usa una notificación del sistema, evitando dobles avisos. No cachear leads ni payloads privados.

Datos propuestos, no implementados:
- `users/{uid}/settings/notifications`: preferencias por canal y fecha de activación, sin destinatarios arbitrarios.
- `users/{uid}/pushDevices/{installationId}`: token privado, habilitado y timestamps. Registro/revocación vía callable autenticado; no exponer ni listar tokens en UI. Un dispositivo no puede seguir asociado al usuario anterior al cambiar de cuenta.
- `leadNotificationJobs/{jobId}`: cola técnica sólo servidor, con UID/leadId/canal/dispositivo, estado, intentos, próximo intento, lease y timestamps. Sin contacto, texto del formulario ni email/token completos en logs.

Identidad de trabajo determinista por UID + leadId + canal; push genera una entrega por instalación. Alta de nuevos dispositivos no provoca replay de solicitudes antiguas. Crear trabajos si las preferencias estaban activas al recibir el lead; volver a comprobar preferencias, destinatario y existencia/propiedad del lead justo antes de enviar. Desactivación posterior cancela entregas pendientes de ese canal/dispositivo. Los tokens expirados/no registrados se revocan sin seguir reintentando.

Firestore puede repetir eventos: un lease adquirido transaccionalmente y un ID determinista evitan ejecuciones concurrentes del mismo trabajo. Trigger habilitado para reintentos; worker intenta al crear trabajo y un recuperador programado retoma trabajos vencidos/listos, con consultas/indexes acotados. Los índices, invocaciones y costes se revisan al implementar; no recorrer todos los usuarios o leads.

Estados: `pending | processing | sent | retryable | failed | skipped`, con intentos por canal/dispositivo. `sent` significa que el proveedor aceptó, no que el usuario recibió/leyó. Códigos sanitizados para fallos. Reintentos propuestos: máximo 5 intentos, backoff con jitter y expiración a 6 h; antes de producción validar el horizonte contra la ventana de idempotencia del proveedor email. Error permanente (destino inválido, token revocado) no reintenta. No reintentar una respuesta ambigua sin la misma clave idempotente.

Email requiere proveedor con clave idempotente estable por trabajo y ventana suficiente: no prometer exactly-once. Push no garantiza exactly-once; reutilizar tag/ID por lead, registrar consumo por dispositivo y evitar notificación duplicada de foreground/background. Una caída después de aceptación externa pero antes de marcar `sent` es un caso de prueba obligatorio y una limitación explícita si el transporte no permite reconciliación.

## Seguridad, privacidad y operación

- UID y destinatarios se resuelven en servidor; el formulario público no elige canal, token o email receptor.
- Reglas: dueño puede consultar preferencias/estado seguro; trabajos técnicos y tokens son sólo servidor. Validar en callables tanto registro como revocación y reautorización. No romper reglas de leads/cuotas existentes. Probar contra emuladores antes de declarar seguras las reglas nuevas.
- Sin pruebas que envíen a usuarios reales. Adaptadores falsos por defecto en emuladores; prueba real posterior sólo con cuentas/dispositivos de ensayo autorizados.
- Separar el consentimiento de contacto del visitante de las preferencias de avisos del titular. Avisos transaccionales, no alta de marketing.
- Límites actuales del formulario siguen aplicando; limitar número de dispositivos por UID (propuesta inicial: 10) y tamaño/cantidad de trabajos por evento. Verificar coste y métricas de fallos sin PII.
- Retención propuesta de trabajos técnicos: 30 días, con limpieza efectiva probada, no sólo campo expiresAt. No cambia la retención manual de leads. Token de dispositivo deja de conservarse tras revocación confirmada.
- Kill switch por canal; despliegue separado para worker/configuración y feature flag, piloto pequeño antes de activar a usuarios. No incluir credenciales en `VITE_*` ni Git.

## Criterios de aceptación

- Un lead nuevo confirmado origina una entrega por canal/destino habilitado; reintento público o evento repetido no crea nuevos trabajos.
- No avisa por actualización, borrado, envío inválido o alta de preferencias posterior al lead. Fallo de trigger/proveedor no elimina el lead ni cambia la respuesta de recepción ya confirmada.
- Preferencias independientes, permiso solicitado con gesto y fallback email aunque push no sea compatible/esté denegado.
- Sólo se notifican datos de la cuenta correcta; logout, cambio de UID/email y revocación no dejan asociaciones activas erróneas.
- Enlace abre la solicitud correcta tras login; usuario ajeno y lead borrado producen estado seguro.
- Los fallos parciales/reintentos se recuperan sin ocultarlos ni declarar lectura/entrega que no se conoce.
- Service worker mantiene offline, actualizaciones y recuperación PWA existentes; sin duplicar avisos.
- Tests de dominio, emuladores (aislamiento/leases/reglas/replay), E2E de ajustes/enlace y prueba física push. Lint, formato, builds web/Functions y suites disponibles correctos antes de cerrar.

## Decisiones pendientes para ejecución

Confirmar supuesto de titular como destinatario, proveedor/remitente/dominio email (SPF/DKIM y tratamiento de rebotes), límites/coste del piloto, compatibilidad real por dispositivo y eventual vinculación Free/Pro. Estos pendientes no impiden tener el diseño ni desarrollar adaptadores falsos; sí impiden activar envíos reales sin concretarlos.

## Fuentes técnicas consultadas

- [FCM web: HTTPS, permisos, VAPID y service worker](https://firebase.google.com/docs/cloud-messaging/web/get-started).
- [Triggers Firestore: eventos repetibles y diseño idempotente](https://firebase.google.com/docs/functions/firestore-events).

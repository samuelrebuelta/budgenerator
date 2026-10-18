# BG-010 — Avisos push al recibir solicitudes

Estado: push únicamente. La app presenta una invitación al iniciar la sesión autenticada y mantiene un interruptor en Mi cuenta. El permiso del navegador sólo se solicita tras una pulsación explícita. Los trabajos históricos de email se descartan sin intentar entregarlos.

## Objetivo y alcance

Avisar al titular de una empresa cuando se crea una solicitud válida desde el estimador público BG-005. La notificación abre la solicitud dentro de la app autenticada. El lead sigue siendo la fuente de verdad: el fallo de push no pierde ni invalida la solicitud.

Entrega a todos los dispositivos FCM que el titular haya activado. No se envía confirmación al visitante, no se añaden destinatarios y no se reenvían solicitudes antiguas cuando se habilitan los avisos.

Fuera de alcance: correo, campañas, marketing, WhatsApp/SMS, equipos con varios destinatarios, recordatorios, IA y un centro histórico general de notificaciones. No cambia la disponibilidad comercial de planes ni los permisos actuales.

## Flujo y experiencia

1. El visitante envía el formulario; `submitPublicLead` valida y guarda la solicitud con el flujo transaccional/idempotente actual. La respuesta no espera al proveedor push.
2. El trigger de creación de `users/{uid}/leads/{leadId}` prepara trabajos idempotentes por dispositivo. Actualizar o enlazar una solicitud no crea otro aviso.
3. El aviso del sistema y el aviso en primer plano usan el texto fijo «Nueva solicitud de presupuesto» y «Tienes una nueva solicitud en BudGenerator», sin datos de contacto ni detalles de la reforma.
4. Destino: `/profile/solicitudes?leadId=<id codificado>`. Si falta sesión, se inicia sesión y se continúa a la ruta validada. Otra cuenta o una solicitud borrada obtiene un estado seguro.

En el primer inicio de una sesión autenticada, la shell presenta «Activa los avisos push» con una acción explícita. La acción pide permiso y registra el dispositivo. No se llama a `Notification.requestPermission()` desde un efecto de montaje: el navegador lo bloquearía o no mostraría su diálogo. «Ahora no» oculta la invitación durante esa sesión. Si FCM marca un FID como inválido, la app renueva ese dispositivo al iniciar sólo cuando la preferencia sigue activa y el permiso ya está concedido; si falla, pide reactivarlo.

En «Mi cuenta → Notificaciones» hay un interruptor push único: al activarlo pide permiso si hace falta, registra el FID del dispositivo actual y guarda la preferencia. Al desactivarlo se pausa la preferencia de la cuenta; la lista permite revocar instalaciones concretas. Si el permiso está bloqueado, se explica que debe cambiarse en Ajustes del navegador/dispositivo. Al volver a la app se refresca el permiso para que el interruptor permita reintentar.

## Arquitectura y datos

Reutilizar Functions v2, Firebase Admin y Firebase Cloud Messaging. Push usa Firebase Web Messaging 12.14.0 (API `register`/`onRegistered` por FID) y Admin 14.1.0. No añadir una segunda cola, worker de service worker ni proveedor de correo.

- `users/{uid}/settings/notifications`: `pushEnabled`, `pushEnabledAt` y `updatedAt`. Al guardar el cliente nuevo se eliminan `emailEnabled` y `emailEnabledAt` heredados.
- `users/{uid}/pushDevices/{installationId}`: FID privado, hash de asociación, estado y timestamps. Sólo Admin SDK modifica el documento.
- `pushInstallationIndex/{fidHash}` y `notificationDeviceCounts/{uid}`: control de asociación única y límite de diez instalaciones, sólo servidor.
- `leadNotificationJobs/{jobId}`: UID, leadId, canal, instalación, estado técnico, intentos, próximo intento, lease y fechas. Sin contacto, contenido del formulario, email ni FID.

El contrato de preferencias acepta `{pushEnabled:boolean}`. Durante la transición admite `{emailEnabled:false,pushEnabled:boolean}` de clientes antiguos y devuelve sólo el campo push; `emailEnabled:true` se rechaza. No se crean nuevos trabajos de email. El worker reconoce trabajos email heredados y los marca `skipped` con `channel_removed` antes de leer datos del lead o del titular.

El ID del trabajo es SHA-256 de UID + leadId + canal + instalación. Un lease transaccional evita ejecuciones concurrentes. El trigger tiene reintentos; un recuperador programado recoge pendientes/reintentables/vencidos. Máximo cinco intentos con backoff y jitter, horizonte de seis horas. Cada trabajo tiene `retentionExpiresAt` a 30 días y usa TTL de Firestore para su eliminación asíncrona; la limpieza diaria acotada queda como respaldo de documentos legacy sin TTL. Antes de enviar se comprueba lead, titular, preferencia, dispositivo y fecha de activación. Si FCM invalida el FID, se borra el FID y su índice y el dispositivo queda `recoveryRequired`; con preferencia activa y permiso ya concedido, la app vuelve a registrarlo al iniciar. La revocación explícita elimina el dispositivo y no se recupera automáticamente.

El service worker FCM se empaqueta e importa desde el `public/sw.js` existente. El payload de segundo plano es sólo data con jobId/leadId; el worker muestra contenido fijo con etiqueta estable y click a la ruta interna. No se cachean leads ni payloads privados.

## Seguridad, privacidad y operación

- Las callables derivan UID de Firebase Auth. Cloud Run permite invocación a nivel de servicio para `getNotificationSettings`, `setNotificationPreferences`, `registerPushDevice` y `revokePushDevice`, pero cada handler exige identidad Firebase antes de actuar.
- Reglas: propietario lee su configuración; preferencias sólo cambian por callable; FIDs, índices, contadores y cola son sólo servidor. No se abren las reglas de leads/cuotas.
- Las pruebas usan Auth/Firestore emulados y transporte push falso. No crear leads reales ni enviar mensajes al desplegar.
- El titular puede activar hasta diez dispositivos. Logout intenta revocar el dispositivo remoto y desregistrar FCM antes de cambiar de usuario; una revocación pendiente se guarda localmente por UID y se reconcilia al volver.
- Los avisos son transaccionales y no incorporan el consentimiento de contacto del visitante. Revocar no puede retirar un aviso que el sistema ya aceptó.
- VAPID es una clave pública que se inyecta al build; no se versiona `.env.local` ni se coloca ninguna clave privada en `VITE_*`.

## Criterios de aceptación

- Evento repetido produce un único trabajo por instalación push activa.
- No se avisa por cambios, borrados, envíos inválidos, leads anteriores a la activación o usuarios/dispositivos revocados.
- El primer inicio muestra invitación, pero el permiso nativo sólo aparece después de la acción de usuario. La recuperación automática no solicita permiso ni revierte una revocación explícita.
- La denegación muestra guía y el interruptor de Mi cuenta puede reintentar tras corregir permisos.
- Ningún trabajo nuevo contiene PII o email; los jobs email históricos quedan en `skipped` y jamás pasan a transporte.
- El enlace abre la solicitud correcta tras login; cuenta ajena y lead eliminado reciben estado seguro.
- La app mantiene el worker PWA existente y no duplica el aviso de primer plano y segundo plano.
- Builds, lint, pruebas unitarias e integración de emuladores pasan antes de publicar. Prueba física de entrega en Android e iOS/PWA queda como verificación manual.

## Verificación pendiente

El registro FCM y la recepción deben verificarse manualmente en una instalación de Android y una PWA instalada en iOS/Safari. El despliegue de código no envía mensajes ni genera solicitudes de prueba.

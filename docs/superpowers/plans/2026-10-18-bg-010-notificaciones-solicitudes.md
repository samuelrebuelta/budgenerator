# BG-010 — Plan de implementación de notificaciones de solicitudes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar al titular por push y email cuando recibe una solicitud válida, sin acoplar su recepción a proveedores.

**Architecture:** Trigger de Firestore → trabajos idempotentes → adaptadores por canal; preferencias privadas y un único service worker PWA.

**Tech Stack:** React, TypeScript, Firebase Auth/Firestore/Functions v2/FCM; proveedor de email transaccional por seleccionar.

**Spec:** `docs/superpowers/specs/2026-10-18-bg-010-notificaciones-solicitudes-design.md`.

## Global Constraints

- No campañas, avisos al visitante, IA, cambios comerciales ni acceso a destinatarios arbitrarios.
- El lead se guarda aunque falle una notificación; las credenciales y los datos de entrega permanecen en servidor.
- Reutilizar `submitPublicLead`, las reglas/cuotas actuales y el service worker PWA existente.
- No enviar a usuarios reales durante pruebas ni activar o desplegar proveedores sin configuración y autorización específicas.

## Review Focus

- Aceptación del proveedor seguida de caída local: verificar idempotencia y no reenviar a ciegas.
- Eventos de creación repetidos o concurrentes: conservar una sola entrega lógica.
- Logout o cambio de usuario con una suscripción push previa: impedir asociación cruzada.
- Desactivar un canal antes de reintentar: cancelar el trabajo pendiente.
- Abrir tras login, con otro usuario o con lead borrado: llegar al lead propio o mostrar un estado seguro.

---

**Estado:** implementación autorizada en este hilo el 18-10-2026; proveedor/dominio y envío real se concretan antes de habilitarlos.

### Task 1: Contratos, preferencias y dispositivos privados

Archivos previstos: `src/shared/types/notifications.ts`, `src/entities/notifications/{index.ts,api/functions.ts}`, `functions/src/notifications/{contracts.ts,preferences.ts}`, exports en `functions/src/index.ts`; tests `tests/notificationPreferences.test.ts`, `tests/notifications.rules.test.ts` y `functions/tests/notificationPreferences.integration.test.ts`; configuración `vitest.notifications.config.ts`. Las reglas actuales ya niegan a clientes acceso a `pushDevices` y colecciones técnicas; sólo cambiarlas si la prueba de emulador descubre una apertura.

Interfaces futuras: `getNotificationSettings()`, `setNotificationPreferences({emailEnabled,pushEnabled})`, `registerPushDevice({installationId,token})`, `revokePushDevice({installationId})`; UID proviene de Auth. La callable de lectura devuelve solo preferencias, email verificado y metadatos de dispositivos, nunca tokens. Email receptor lo obtiene el worker de Auth, no del request.

- [x] Escribir tests de preferencias independientes, validación estricta, límite de 10 dispositivos, usuario ajeno/anónimo y cambio de UID; reglas deniegan lectura/escritura de tokens y trabajos técnicos al cliente. La lectura de preferencias y estado seguro usa callable autenticada porque Firestore Rules no ofrece filtrado por campo.
- [x] Ejecutar tests específicos y verlos fallar antes de implementar.
- [x] Implementar contratos/callables con fechas servidor, aislamiento y revocación/reasociación segura. Consultar reglas reales y contratos actuales antes de modificar.
- [x] Ejecutar tests de reglas reales en emulador y dominio; commit cohesivo de esta tarea.

### Task 2: Trabajos duraderos e idempotentes

Archivos previstos: `functions/src/notifications/{jobs.ts,leadCreated.ts,worker.ts}`, `functions/src/index.ts`, `firestore.indexes.json` si lo requieren las consultas; tests `tests/leadNotificationJobs.test.ts` y `tests/leadNotificationJobs.integration.test.ts`.

Interfaces futuras: `enqueueLeadNotifications({uid,leadId,eventTime})` y `processNotificationJob(jobId)`; contratos en tarea 1. Estados/leases/IDs y horizonte de 6 h definidos por spec. Handler de creación no modifica el lead.

- [ ] Test RED de lead repetido, evento simultáneo, preferencias activadas después del lead, actualización sin aviso, dispositivo nuevo sin replay y caída del trigger seguida de reintento.
- [ ] Implementar creación determinista y transaccional de trabajos; worker con lease, cinco intentos, backoff/jitter y recuperador acotado. Adaptadores falsos, sin SDK/proveedor real aún.
- [ ] Probar desactivación/lead borrado/usuario cambiado antes de envío, recuperación de lease y fallo independiente por canal/dispositivo.
- [ ] Probar recuperación programada y limpieza efectiva a 30 días. Ejecutar integración en emulador; commit.

### Task 3: Transporte email transaccional

Archivos previstos: `functions/src/notifications/{email.ts,providers/emailProvider.ts}`, tests `tests/leadEmail.test.ts`; configuración de secretos documentada en `docs/firebase.md`, nunca en frontend.

Interface: `sendLeadEmail({jobId,to,managementUrl}) → Promise<{providerMessageId:string}>`, con adaptador falso inyectable. Seleccionar proveedor con idempotencia cuya ventana cubra el retry antes de implementar adaptador real; documentar remitente verificado, DNS, costes y sandbox.

- [ ] Test RED de email Auth verificado frente a contacto del lead/perfil, contenido mínimo escapado, URL del origen permitido y mismo jobId en reintentos.
- [ ] Implementar renderer sin PII y transporte; no considerar aceptación como entrega/lectura. Clasificar timeout ambiguo, rate-limit, rechazo permanente y rebote sin reenvío ciego.
- [ ] Reproducir caída después de aceptación externa, antes de `sent`; verificar deduplicación con el contrato del proveedor elegido.
- [ ] Suite con proveedor falso; ninguna prueba real sin cuenta de ensayo autorizada. Commit.

### Task 4: Push y PWA existente

Archivos previstos: `src/features/notifications/{index.ts,model/push.ts}`, `public/sw.js`, `scripts/build-sw.mjs` sólo si requiere bundling; `functions/src/notifications/push.ts`; tests `tests/leadPush.test.ts` y `tests/e2e/notifications.spec.ts`.

Interfaces: activación/revocación por dispositivo mediante tarea 1; transporte `sendLeadPush({jobId,token,managementUrl})`. Comprobar versión SDK instalada y APIs oficiales antes de codificar. Pasar el worker existente, sin registrar un sustituto.

- [ ] Test RED de soporte ausente, permiso denegado, grant mediante click, token inválido, logout/cambio de UID y aviso pendiente de cuenta anterior.
- [ ] Implementar token privado, ciclo de registro/revocación, detección de soporte y lazy-load FCM para evitar coste de arranque innecesario.
- [ ] Worker maneja push/click con destino seguro; foreground presenta un único aviso y background una única notificación. Probar dedupe/tag y offline/actualización existentes.
- [ ] Documentar limitación de entrega repetida/avisos ya aceptados por el SO; validar físicamente Android e iOS/PWA antes de rollout. Commit.

### Task 5: Ajustes y navegación al lead

Archivos previstos: `src/features/notifications/ui/NotificationSettings.tsx`, `src/pages/account/AccountPage.tsx`, `src/pages/leads/LeadsPage.tsx`, guard/login donde sea necesario preservar ruta de retorno; tests `tests/e2e/notifications.spec.ts`.

- [ ] Test RED de toggles independientes, dirección verificada/pendiente, permiso bloqueado y errores. No disparar permiso al montar.
- [ ] Implementar sección Notificaciones reutilizando componentes actuales; copy de estados y controles de dispositivo de la spec, movimiento reducido y teclado.
- [ ] Test RED de `/profile/solicitudes?leadId=...`: lead correcto tras login, lead ajeno/inexistente, recarga y retorno sin open redirect.
- [ ] Implementar enfoque/selección desde URL validada, con estados seguros. E2E y revisión visual móvil/desktop; commit.

### Task 6: Cierre y rollout separado

- [ ] Ejecutar lint, formato, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm build:functions`; registrar resultados reales y límites de emulación.
- [ ] Revisar aislamiento, reglas, secretos, logs sin PII, leases, idempotencia y regresiones del estimador/PWA. Revisión independiente antes de merge.
- [ ] Actualizar `docs/plan.md`, `docs/firebase.md`, `docs/architecture.md` y documentos de estados/PWA afectados.
- [ ] Preparar feature flags/kill switches por canal, índices, configuración VAPID/proveedor, presupuesto de piloto y guía de rollback. No activar por existir el plan.
- [ ] Tras autorización específica: prueba controlada con destinatarios de ensayo, comprobar canales reales y después habilitación gradual. No migrar ni reenviar leads históricos.

## Estado de esta preparación

Spec y plan registrados; rutas y submitPublicLead contrastados con el código actual, y documentación oficial de FCM/triggers consultada. Pendientes todas las tareas de implementación. No se han ejecutado tests de esta feature ni enviado notificaciones.

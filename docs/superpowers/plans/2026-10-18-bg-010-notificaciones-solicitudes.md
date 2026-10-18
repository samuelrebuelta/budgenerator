# BG-010 — Avisos push de nuevas solicitudes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use `- [ ]` syntax for tracking.

**Goal:** Avisar al titular cuando recibe una solicitud válida, únicamente mediante notificaciones push en los dispositivos que active.

**Architecture:** Trigger de Firestore → trabajos idempotentes por dispositivo → Firebase Cloud Messaging; preferencias privadas y service worker PWA existente.

**Tech stack:** React, TypeScript, Firebase Auth/Firestore/Functions v2/FCM.

**Spec:** `docs/superpowers/specs/2026-10-18-bg-010-notificaciones-solicitudes-design.md`.

## Límites y revisión

- No campañas, avisos al visitante, IA, cambios comerciales ni destinatarios arbitrarios.
- El lead se guarda aunque falle push. Los trabajos no contienen contacto del visitante, correo del titular ni FID.
- Reutilizar `submitPublicLead`, reglas/cuotas y service worker existentes.
- No crear leads de prueba ni enviar mensajes reales durante las pruebas de código.
- Los trabajos de email históricos se descartan; no se migran ni reenvían.
- Cada callable deriva UID de Firebase Auth. Cloud Run permite la invocación de las callables autenticadas a nivel de transporte, y el handler exige Auth.

## Tareas

### 1. Preferencias y dispositivos privados

- [x] Contrato de preferencias sólo push; tolera únicamente `emailEnabled:false` de clientes antiguos.
- [x] Las preferencias se consultan por callable autenticada; los FIDs, índices y contadores siguen siendo privados.
- [x] Registro/revocación por dispositivo, límite de diez, reasociación de FID y limpieza pendiente al volver.
- [x] Al guardar desde un cliente actual se eliminan las antiguas preferencias de email.

### 2. Trabajos idempotentes y envío FCM

- [x] Trigger de creación, IDs SHA-256, leases, cinco intentos y recuperación acotada; TTL Firestore elimina los trabajos a los 30 días y la tarea diaria cubre documentos legacy sin TTL.
- [x] Se crean trabajos push únicamente; leads anteriores a la activación no se reproducen.
- [x] El worker descarta los trabajos email heredados con `skipped/channel_removed` antes de aplicar límites de reintento, sin transporte de email.
- [x] La entrega omite contacto del lead y abre sólo la ruta autenticada `/profile/solicitudes?leadId=…`.

### 3. Activación y navegación

- [x] La shell autenticada presenta una invitación de activación al inicio; permiso nativo sólo desde un gesto explícito del usuario.
- [x] El interruptor de Mi cuenta pide permiso, registra el FID actual y guarda la preferencia como una acción.
- [x] Tras una denegación, el estado orienta a cambiar permisos y se refresca al volver de Ajustes; el interruptor permite reintentar.
- [x] Se conserva la gestión/revocación de dispositivos y la navegación segura a la solicitud tras login.

### 4. Verificación y publicación de prueba

- [x] Tests unitarios del contrato push-only y estados de invitación.
- [x] Integración aislada Auth/Firestore: 11 tests; reglas de notificaciones: 2 tests.
- [x] `pnpm lint` y `pnpm build:functions`.
- [x] `pnpm test` (29 archivos, 121 tests), `pnpm format:check`, `pnpm build`, `pnpm build:functions` y `pnpm lint`.
- [x] Integración Auth/Firestore aislada (11 tests), reglas de notificaciones (2 tests) y E2E de activación push aislado (1 test).
- [x] Desplegar Functions y Hosting en `budgenerator`; confirmar que las cuatro callables sin sesión devuelven `UNAUTHENTICATED` del handler.
- [ ] Verificar recepción en dispositivo Android y PWA instalada en iOS/Safari; no se envía ningún mensaje durante el despliegue.

## Estado anterior y evidencias

El despliegue inicial de BG-010 en `budgenerator` publicó Hosting PWA `13a9d4d6113bf954`, backend e índices. Para esta reparación, Functions y Hosting se desplegaron en `budgenerator`; las 13 Functions quedaron actualizadas y la PWA publicó hash `c12bd1674c213281`. Los 94 archivos de `dist` coinciden byte a byte con Hosting y el bundle de notificaciones contiene la VAPID local, cuyo valor no se registra en Git ni documentación.

La captura mostraba un rechazo 401 en Cloud Run antes del handler. Se añadió `roles/run.invoker` para `allUsers` únicamente a `getNotificationSettings`, `setNotificationPreferences`, `registerPushDevice` y `revokePushDevice`. Las cuatro callables se probaron sin sesión: cada una responde HTTP 401 `UNAUTHENTICATED` con el error Firebase del handler. Los handlers siguen requiriendo Auth. No se publicaron reglas, no se cambiaron documentos Firestore, no se escribieron leads y no se enviaron mensajes.

## Decisión de permiso web

Los navegadores sólo pueden abrir el diálogo nativo como resultado de una acción directa del usuario. Al iniciar la sesión se muestra una invitación con botón; al pulsarlo se pide permiso. Si está denegado, la app explica que debe cambiarse en los ajustes del navegador o del dispositivo y permite reintentar desde Mi cuenta.

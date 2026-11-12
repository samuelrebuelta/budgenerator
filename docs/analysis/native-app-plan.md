# BG-N01 — Plan de app nativa iOS/Android (React Native + Expo)

> **Estado: propuesta de especificación pendiente de aprobación.** AGENTS.md exige una especificación aprobada para cualquier integración de código o monorepo. Este documento no autoriza cambios de código, estructura de repositorio, reglas, Functions ni despliegues. Redactado el 11-11-2026 a partir de `main` (`59d00d2`).

## 0. Resumen ejecutivo

- **Qué:** una app nativa iOS/Android de BudGenerator para la empresa de reformas (usuario autenticado), construida con Expo (dev client + CNG) y Expo Router, que reutiliza el dominio TypeScript existente y el mismo proyecto Firebase.
- **Por qué:** push fiable en iOS (hoy depende de PWA instalada y Web Push), fotos de obra, PDF compartido con el share sheet nativo, uso real sin conexión en obra y presencia en las tiendas.
- **Cómo:** monorepo pnpm **incremental** (la web se queda en la raíz al principio), paquete `@bg/domain` con la lógica pura ya existente, `@react-native-firebase` en móvil y Firebase JS SDK en web.
- **Cuánto:** ~19–25 semanas de 1 desarrollador hasta publicación en ambas tiendas (detalle en §9). Núcleo en beta interna a las ~9–12 semanas (fases 0–1) y MVP completo con push nativo a las ~14–18 (fase 2).
- **Decisiones que bloquean el arranque:** §9.4 (D1–D10). Las más importantes: aprobar el monorepo, aceptar persistencia offline de Firestore en móvil (cambia la decisión BG-012 para esa plataforma), y la política de monetización si BG-004 se reactiva.

---

## 1. Objetivos y alcance

### 1.1 Valor frente a la PWA actual

| Necesidad                | Situación PWA (evidencia)                                                                                                                                                                                                                                                                                                 | Aporte nativo                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Avisos de solicitudes    | Web Push sólo funciona en iOS con la PWA instalada; varios incidentes de entrega documentados en `docs/firebase.md` (FID no registrados, `recoveryRequired`, recuperación manual de la instalación). Lógica compleja en `src/features/notifications/model/push.ts` (345 líneas, service worker en `:53`, `:137`, `:323`). | APNs/FCM nativos, entrega con la app cerrada, canales Android, deep link directo al lead.                      |
| Consulta en obra sin red | BG-012 sólo conserva lo ya consultado y **bloquea toda mutación offline** (`docs/specs/BG-012-modo-offline.md`, criterio 8).                                                                                                                                                                                              | Caché persistente nativa de Firestore y, en fase 3, escrituras offline acotadas (marcar partidas completadas). |
| Fotos de obra            | No existe Storage (`docs/firebase.md`: «No hay Storage»). El logo vive como data URL en `profile/data`.                                                                                                                                                                                                                   | Cámara y galería con compresión, subida diferida a Cloud Storage. Funcionalidad nueva: requiere spec propia.   |
| Enviar el PDF al cliente | `ExportPdfButton` abre una ventana o descarga (`src/shared/lib/pdf.ts:240-247`).                                                                                                                                                                                                                                          | Share sheet nativo (WhatsApp, Mail, AirDrop) con el PDF generado en el dispositivo.                            |
| Firma del cliente        | No existe.                                                                                                                                                                                                                                                                                                                | Firma en pantalla sobre el presupuesto aceptado (fase 3, opcional; requiere spec).                             |
| Geolocalización          | No existe.                                                                                                                                                                                                                                                                                                                | Abrir la obra en Mapas desde la dirección del proyecto (bajo coste); fichaje por ubicación queda fuera.        |
| Distribución             | Instalación manual de la PWA (`src/app/pwaInstall.ts`).                                                                                                                                                                                                                                                                   | App Store / Google Play, actualizaciones OTA.                                                                  |

### 1.2 MVP nativo (fases 1–2) frente a paridad

**MVP nativo (lo que justifica publicar):**

1. Login, registro y recuperación de contraseña (email/contraseña, igual que hoy: `src/entities/auth/api/firebase.ts:14-19`).
2. Presupuestos: lista, detalle, edición de partidas/conceptos, alta guiada desde catálogo (`features/budget-structure`), aceptación, exportar/compartir PDF, compartir enlace público.
3. Proyectos: lista, detalle, marcar partidas, fechas de finalización, suplementos y anulaciones, historial de progreso.
4. Equipo: planificación semanal, asignaciones diarias, trabajos puntuales; gestión de personas y cuadrillas.
5. Solicitudes: bandeja, detalle, borrar, crear presupuesto desde lead; **push nativo**.
6. Mi cuenta: perfil de empresa (logo desde galería), preferencias de avisos, cambio de contraseña, **eliminación de cuenta** (obligatoria en tiendas, hoy inexistente).
7. Consulta offline de lo ya sincronizado.

**Paridad (fase 2 tardía):** catálogo completo con importación de bibliotecas (`TRADE_CATALOGS`), plantillas, ayuda, tour inicial adaptado.

### 1.3 Qué se queda sólo en web

| Módulo                              | Ruta actual                                                                           | Motivo                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Administración                      | `/admin` (`src/pages/admin/AdminPage.tsx`, `src/app/AdminGuard.tsx:7`)                | Uso interno, una sola identidad; no aporta en tienda y aumenta la superficie de revisión.                                                                    |
| Configuración del estimador público | `/estimator` (`src/pages/quote-estimator/QuoteEstimatorSettingsPage.tsx`, 763 líneas) | Configuración puntual de tarifas por estancia; en móvil se muestra un resumen (estado, copiar/compartir enlace, revocar) y un enlace «Configurar en la web». |
| Estimador público del visitante     | `/solicitar-presupuesto/:token`                                                       | Lo usa un tercero sin cuenta desde la landing de la empresa.                                                                                                 |
| Visor público de presupuesto        | `/shared/:token`                                                                      | Lo abre el cliente final; no debe exigir instalar la app.                                                                                                    |
| Edición masiva de catálogo (fase 1) | `/catalog` (`CatalogDetailPage.tsx`, 801 líneas)                                      | Pantalla densa; en fase 1 sólo lectura/búsqueda y selección, edición en fase 2.                                                                              |
| BC3                                 | rama `codex/bc3-native-model`                                                         | Fuera de `main`; intercambio de ficheros propio de escritorio.                                                                                               |

---

## 2. Decisión de repositorio

### 2.1 Opciones

| Criterio                                                       | Monorepo pnpm workspaces                                                                                                 | Repos separados                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Reutilizar dominio (cálculos, contratos, validaciones)         | Directo, un solo origen de verdad                                                                                        | Paquete npm privado versionado, publicación en cada cambio |
| Riesgo de divergencia de importes entre web, móvil y Functions | Bajo: mismos tests                                                                                                       | Alto                                                       |
| Cambios atómicos (contrato + reglas + web + móvil)             | Una PR                                                                                                                   | Varias PR coordinadas                                      |
| Coste inicial                                                  | Medio (mover código, configurar Metro/TS)                                                                                | Bajo al principio, alto después                            |
| Herramientas                                                   | Expo soporta monorepos pnpm (Metro autoconfigurado desde SDK 52; instalaciones aisladas de pnpm soportadas desde SDK 54) | Sin fricción de tooling                                    |

**Evidencia de que ya existe una dependencia compartida de facto:** Functions importa código de la app web por ruta relativa: `functions/src/quoteEstimator.ts:10-40` importa `../../src/shared/types` y `../../src/entities/quote-estimator/model/{estimate,types,leads}`. Es un monorepo implícito sin límites declarados.

### 2.2 Recomendación: monorepo pnpm incremental

Estructura objetivo:

```text
/                         (raíz: pnpm-workspace.yaml, firebase.json, firestore.rules, tests de reglas)
├── apps/
│   ├── web/              (PWA actual; se mueve en el paso 0.4, no antes)
│   └── mobile/           (Expo)
├── packages/
│   ├── domain/           (@bg/domain: tipos, cálculos, catálogo, estimador, proyectos, planificación)
│   ├── firebase-api/     (@bg/firebase-api: contratos de datos y repositorios con SDK inyectado)
│   ├── app-core/         (@bg/app-core: stores Zustand, WriteQueue, red, sesión con puertos de plataforma)
│   ├── i18n/             (@bg/i18n: translation.json + init i18next)
│   └── ui-tokens/        (@bg/ui-tokens: colores, tipografía, radios, espaciado)
└── functions/            (se mantiene; pasa a depender de @bg/domain en vez de ../../src)
```

**Por qué incremental:** mover la PWA a `apps/web` toca `vite.config.ts`, `tsconfig*.json` (alias `@/`), `firebase.json` (`hosting.public: dist`), `scripts/build-sw.mjs`, `scripts/deploy.mjs`, `playwright.config.ts`, tres configs de Vitest y el CI. Hacerlo a la vez que se extrae el dominio multiplica el riesgo sobre una app en producción. Por eso:

1. Paso 0.1: añadir `pnpm-workspace.yaml` con `packages/*` y `apps/mobile`, **web en la raíz**.
2. Paso 0.2: extraer `@bg/domain` y hacer que web y Functions importen de él (re-exportando desde las rutas antiguas para minimizar el diff).
3. Paso 0.3: extraer `@bg/i18n` y `@bg/ui-tokens`.
4. Paso 0.4 (opcional, cuando la app móvil esté en beta): mover la web a `apps/web`.

**Coste estimado de migración de la PWA:** pasos 0.1–0.3 ≈ 1,5–2 semanas; paso 0.4 ≈ 0,5–1 semana adicional. Criterio de aceptación: `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:rules`, `pnpm build:functions` y `pnpm test:e2e` sin cambios de comportamiento; mismo hash de contenido del PDF de referencia de `tests/pdf.test.ts`.

### 2.3 Inventario de extracción

#### A. Puro TS, extraíble tal cual a `@bg/domain` (sin DOM ni Firebase)

| Módulo                                                                                                                        | Líneas | Notas                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `src/shared/types/index.ts`, `notifications.ts`, `workforce.ts`                                                               | 157    | Contratos de datos; `UserPlan` en `index.ts:120`.                                    |
| `src/shared/lib/budgetMath.ts`                                                                                                | 63     | `money`, `taskAmount`, `budgetTotals`, `assertBudget` (`:3-39`). Núcleo de importes. |
| `src/entities/budget/model/serialization.ts`, `publicBudget.ts`                                                               | 107    | DTO público con lista explícita de campos.                                           |
| `src/entities/catalog/model/catalog.ts`, `baseCatalogs.ts`, `migrate.ts`, `search.ts`                                         | 2.386  | Catálogo jerárquico, bibliotecas `TRADE_CATALOGS`, búsqueda.                         |
| `src/entities/catalog/model/tradeImport.ts`                                                                                   | 73     | Sólo depende de `generateId` (`:3`) — ver nota sobre `utils.ts`.                     |
| `src/entities/project/model/{assignments,conversion,dailyAssignments,estimatedEndDate,history,progress,supplements,types}.ts` | 780    | Conversión, progreso, conflictos diarios (`dailyAssignments.ts:41-123`).             |
| `src/entities/quote-estimator/model/{estimate,leads,types}.ts`                                                                | 566    | Ya compartido con Functions; `calculateQuoteRange` en `estimate.ts:303`.             |
| `src/entities/workforce/model/{teamJobs,types,validation}.ts`                                                                 | 268    | Validación de trabajos puntuales y snapshots.                                        |
| `src/features/budget-structure/model.ts`                                                                                      | 118    | `rankPartConcepts`, `structureFromSelection` (`:16`, `:70`).                         |
| `src/features/notifications/model/navigation.ts`                                                                              | 37     | Validación de `leadId` en enlaces.                                                   |
| `src/pages/help/helpContent.ts`                                                                                               | 214    | Contenido de ayuda.                                                                  |

**Requieren un ajuste mínimo antes de extraer:**

- `src/shared/lib/utils.ts`: mezcla dominio (`FREE_BUDGET_LIMIT`, `formatCurrency`, `generateId`) con estilo web (`cn` con `clsx`/`tailwind-merge`, `:12-14`). Separar `cn` en la web. `generateId` usa `crypto.randomUUID()` (`:24-26`): en RN requiere `expo-crypto` (`randomUUID`) inyectado o polyfill.
- Helpers de fecha embebidos en componentes: `WeeklyProjectSchedule.tsx:80-148` (`dateFromKey`, `mondayOf`, `shiftWeek`, `formatWeekRange`, `dayAssignments`), `WorkforcePage.tsx:38-56` (`validDateKey`, `localDateKey`) y `ProjectDetailPage.tsx:43` (`workItemProgress`). Mover a `@bg/domain/schedule` y `@bg/domain/project` con tests.
- `src/pages/catalogs/catalogSummary.ts` y `src/pages/workforce/crewColors.ts`: dependen de `t` o de colores; pasar a `@bg/domain` con inyección de textos/colores.
- `src/shared/lib/pdf.ts`: `buildBudgetDocument` (`:41`) es portable (jsPDF + cálculos); sólo `loadLogo` (`:12-39`, `Image` + `canvas`) y `generateBudgetPdf` (`:240-247`, `URL.createObjectURL`) son web. Ver §3.8.

#### B. Portable con puertos de plataforma → `@bg/app-core`

| Módulo                                                                                                  | Dependencia de plataforma                                                                                                                                                            | Puerto                                                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `src/shared/lib/writeQueue.ts` (debounce 700 ms, `:17`)                                                 | Ninguna (Zustand)                                                                                                                                                                    | —                                                            |
| `src/shared/model/session.ts`, `sync.ts`, `toast.ts`                                                    | Ninguna                                                                                                                                                                              | —                                                            |
| `src/shared/lib/networkMutation.ts`                                                                     | Ninguna directa                                                                                                                                                                      | —                                                            |
| `src/shared/model/network.ts`                                                                           | `navigator.onLine` (`:15-16`, ya con guarda `typeof`)                                                                                                                                | `ConnectivityPort` → `@react-native-community/netinfo`       |
| `src/shared/lib/memoryResourceCache.ts`                                                                 | Persiste vía `offlineStateCache`                                                                                                                                                     | `KeyValueStore`                                              |
| `src/shared/lib/offlineStateCache.ts`                                                                   | IndexedDB (`:22-27`)                                                                                                                                                                 | `KeyValueStore` → MMKV (o SQLite si el volumen lo pide)      |
| Stores `entities/*/model/store.ts` (auth, budget, catalog, profile, project, template, user, workforce) | Importan `@/shared/firebase/config` o su `api`; `budget/model/store.ts:93-101` usa `sessionStorage` para drafts; `profile/model/store.ts:30-36` usa `canvas` para normalizar el logo | `DraftStorage`, `ImageNormalizer`, inyección de repositorios |
| `src/app/session.ts` (`resetSession :38`, `loadSession :64`, `probeSessionConnection :125`)             | Firebase `User` y stores                                                                                                                                                             | Inyección de repositorios                                    |

#### C. Dependiente del Firebase Web SDK → `@bg/firebase-api` con SDK inyectado

`src/shared/firebase/config.ts` (`import.meta.env`, `getAuth`, `getFirestore`, emuladores), y todos los `entities/*/api/*.ts`: auth, budget (incluye `acceptance.ts`), catalog, notifications (callables), profile, project (950 líneas), quote-estimator, template, user, workforce (280 líneas).

**Punto a favor:** `project` y `workforce` ya usan inyección (`createProjectFirestoreApi(database)` en `src/entities/project/api/firestore.ts:124`, `createWorkforceFirestoreApi(database)` en `src/entities/workforce/api/firestore.ts:60`). El resto importa `db` del módulo de configuración y debe migrar al mismo patrón.

#### D. Exclusivo de web (no se comparte)

Todo `src/app` (router, `AppShell`, `PwaStatus`, `pwa.ts`, `pwaInstall.ts`, `refreshOnReconnect.ts`), `src/shared/ui/*` (Tailwind, `page-view-transition.ts`, `SwipeActions.tsx`), `src/features/notifications/model/push.ts` y `messaging-sw.ts` (service worker), `src/features/app-tour/model.ts` (`localStorage`), todos los `pages/*.tsx`. En móvil se reescriben las vistas; la lógica de negocio que contengan se extrae antes (punto A).

---

## 3. Stack

> **Versiones (noviembre de 2026).** Mi información fiable llega hasta mediados de 2026. Tomar como referencia **la última Expo SDK estable en el momento de arrancar** (previsiblemente SDK 55 o posterior, con React Native ≥ 0.83 y React 19.x; New Architecture obligatoria desde SDK 55). No fijo números exactos: se fijan en la fase 0 con `npx create-expo-app@latest` y `npx expo install --check`. Mantener React alineado con la web (hoy `react@^19.2.4`).

### 3.1 Base

- **Expo con dev client + CNG (`npx expo prebuild` sólo en CI/EAS, carpetas `ios/` y `android/` fuera de Git).** Necesario por `@react-native-firebase`, MMKV y config plugins; Expo Go no sirve.
- **Expo Router** (rutas por fichero, deep links tipados, tabs y stacks nativos).
- **TypeScript strict** con la misma configuración base que la web (`tsconfig` compartido en la raíz).
- **Hermes** como motor (por defecto).

### 3.2 Firebase: JS SDK frente a `@react-native-firebase`

| Área                  | Firebase JS SDK en RN                                                                            | `@react-native-firebase` (RNFB)                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                  | Funciona; persistencia con `getReactNativePersistence(AsyncStorage)`; sin integración de llavero | Nativo; sesión persistida por el SDK de iOS/Android                                                                                                                   |
| Firestore offline     | **Sólo caché en memoria** (no hay IndexedDB en RN): sin persistencia entre arranques             | Persistencia en disco nativa, escrituras offline encoladas, `clearPersistence()`                                                                                      |
| FCM / APNs            | No disponible (Web Messaging requiere service worker)                                            | `@react-native-firebase/messaging`: token FCM, APNs vía FCM, mensajes en background                                                                                   |
| App Check             | Sólo proveedores web (reCAPTCHA): no válido en nativo                                            | App Attest/DeviceCheck (iOS) y Play Integrity (Android)                                                                                                               |
| Crashlytics/Analytics | No                                                                                               | Sí (opcional)                                                                                                                                                         |
| API                   | Idéntica a la web (máxima reutilización)                                                         | API modular parecida a la web (`getFirestore`, `doc`, `runTransaction`…) desde v22; diferencias en tipos (`Timestamp`, `FieldValue`), `getAfter` no aplica en cliente |
| Coste                 | Ninguno extra                                                                                    | Requiere dev client y config plugins; actualizaciones nativas vía EAS Build                                                                                           |

**Recomendación: RNFB en móvil (`app`, `auth`, `firestore`, `functions`, `messaging`, `app-check`; `crashlytics` opcional si no se usa Sentry), JS SDK en web.** Push y App Check nativos no son posibles con el JS SDK, y la persistencia offline es el principal valor diferencial.

**Cómo compartir los repositorios de datos:** `@bg/firebase-api` exporta factorías `createXxxApi(sdk)` que reciben un objeto mínimo con las funciones que usan (`doc`, `getDoc`, `setDoc`, `updateDoc`, `runTransaction`, `collection`, `query`, `where`, `getDocs`, `serverTimestamp`, `httpsCallable`). Web inyecta `firebase/firestore`; móvil inyecta `@react-native-firebase/firestore`. **Spike obligatorio en fase 0** (2–3 días): portar `project/api/firestore.ts` y ejecutar los mismos tests contra el emulador desde ambos SDK. Si las diferencias de tipos lo hacen inviable, fallback: repositorios separados por plataforma con una **suite de contrato común** ejecutada contra emuladores.

### 3.3 Estado

Reutilizar **Zustand 5** y los stores existentes vía `@bg/app-core`, con la protección de revisión de sesión (`docs/state-and-cache.md`) y `WriteQueue`. Sustituir:

- `offlineStateCache` (IndexedDB) → adaptador MMKV con el mismo particionado por UID y `deleteOfflineUserData(uid)` (`offlineStateCache.ts:179`).
- Drafts en `sessionStorage` (`budget/model/store.ts:93-101`) → MMKV con clave por UID; se borran igual al descartar, guardar o cerrar sesión.
- Red → NetInfo + estado de Firestore.

### 3.4 Estilos y tokens

| Opción                            | Pros                                                    | Contras                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NativeWind (v4/v5)                | Clases Tailwind familiares; reutiliza nombres de tokens | Soporte de Tailwind 4 en NativeWind todavía en maduración a mi fecha de corte; capa extra de compilación; las clases web no se copian 1:1 (sin `hover`, grid limitado) |
| `StyleSheet` + tokens compartidos | Sin dependencias; rendimiento predecible; tipado        | Más verboso                                                                                                                                                            |

**Recomendación: `StyleSheet` + `@bg/ui-tokens`, con un pequeño set de primitivas propias (`Text`, `Button`, `Card`, `Sheet`, `ListRow`).** Los componentes web no se reutilizan de todos modos y evita depender de la compatibilidad de NativeWind con Tailwind 4. `@bg/ui-tokens` exporta un objeto TS (colores `blue-50…900`, `gray-50…900`, fuentes Manrope/Fraunces, radios, espaciado) que **genera** el bloque `@theme` de `src/index.css:17-40` mediante un script, de modo que la fuente de verdad es única. Reabrir la decisión si NativeWind publica soporte estable de Tailwind 4 antes de la fase 1.

### 3.5 Formularios

Los formularios web son controlados con estado local, sin librería. Para móvil: **react-hook-form** sólo en formularios largos (perfil de empresa, alta de trabajo puntual `NewTeamJobForm.tsx`, 450 líneas) y estado local en el resto; validación con las funciones ya existentes de `@bg/domain` (p. ej. `workforce/model/validation.ts`, `assertBudget`), sin añadir Zod salvo necesidad demostrada. Teclado: `react-native-keyboard-controller`.

### 3.6 Listas

**FlashList** para presupuestos, proyectos, solicitudes, catálogo (miles de partidas en `baseCatalogs.ts`) y roster. `SectionList`/FlashList con cabeceras para capítulos del presupuesto.

### 3.7 Almacenamiento local

- **react-native-mmkv**: snapshots offline por UID, drafts, preferencias de UI, cola de revocación de dispositivos (equivalente a `PENDING_REVOCATIONS_KEY` de `push.ts:210-226`).
- **expo-secure-store**: identificador de instalación del dispositivo (equivalente a `INSTALLATION_KEY`, `push.ts:66-82`) y cualquier secreto local. No se guardan contraseñas.
- Cifrado de MMKV con clave en SecureStore (mejora frente a la web, donde IndexedDB no se cifra).

### 3.8 PDF

| Opción                                                 | Pros                                                                                               | Contras                                                                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reutilizar `buildBudgetDocument` (jsPDF) en Hermes** | PDF idéntico a la web y a los tests existentes (`tests/pdf.test.ts`); una sola política de cálculo | Validar jsPDF en Hermes (usa `atob/btoa`, presentes en Hermes moderno); el logo ya está normalizado a PNG en el perfil, así que sólo hay que leer ancho/alto de la cabecera PNG en lugar de `canvas` |
| `expo-print` con HTML                                  | Tipografías y maquetación HTML; impresión AirPrint                                                 | Segunda plantilla que divergirá del PDF web; paginación de tablas largas menos controlable                                                                                                           |
| `react-native-html-to-pdf` / PDF nativo                | Rendimiento                                                                                        | Dependencia nativa adicional; misma divergencia                                                                                                                                                      |

**Recomendación:** reutilizar jsPDF (`doc.output('datauristring')` → `expo-file-system` → `expo-sharing` para compartir y `expo-print` sólo para imprimir el fichero). Spike en fase 0 con el documento largo de los tests. Fallback: `expo-print` con plantilla HTML generada desde los mismos totales de `budgetMath`.

### 3.9 Notificaciones

- **Token y recepción:** `@react-native-firebase/messaging` (token FCM; en iOS FCM gestiona APNs). `expo-notifications` no sirve para obtener el token FCM en iOS (`getDevicePushTokenAsync` devuelve el token APNs crudo) y no se usará el servicio Expo Push porque el envío ya está en Functions con Admin SDK.
- **Presentación y permisos:** `expo-notifications` para pedir permiso (tras acción del usuario, como hoy), canales Android, presentación en foreground y respuesta al toque.
- **Payload:** hoy es data-only con `webpush` (`functions/src/notifications/fcm.ts:34-41`). En iOS un mensaje data-only no se muestra con la app cerrada; ver §5.3.

### 3.10 i18n

`@bg/i18n` con `public/locales/es/translation.json` (≈13 KB) e init síncrono igual que `src/shared/i18n/index.ts`. Fechas e importes con `Intl` (Hermes incluye `Intl`; verificar `es-ES` en Android). Muchas cadenas siguen en JSX (23 ficheros de `src/pages` con literales): no bloquea, pero las nuevas pantallas deben usar claves.

### 3.11 Cámara e imagen

`expo-image-picker` (galería y cámara), `expo-image-manipulator` (redimensionar/comprimir; sustituye el `canvas` de `profile/model/store.ts:30-36` para el logo), `expo-image` para mostrar. Fotos de obra (fase 3) requieren Cloud Storage y spec propia.

### 3.12 Enlaces y deep links

- **Esquema** `budgenerator://` para OAuth futuro y pruebas.
- **Universal Links / App Links** en `budgenerator.web.app` (o dominio propio si existe): `apple-app-site-association` y `assetlinks.json` en `/.well-known/` servidos por Hosting (añadir cabecera `Content-Type: application/json` en `firebase.json`).
- **Rutas que abre la app:** `/profile/solicitudes?leadId=…` (notificaciones), `/projects/:id`, `/budget/:id`, acción de restablecer contraseña.
- **Rutas que siguen en web:** `/shared/:token` y `/solicitar-presupuesto/:token` (excluidas en AASA con `"exclude": true`), porque las usan terceros.
- Firebase Dynamic Links se apagó en agosto de 2025: no usarlo.

### 3.13 OTA, crash y analítica

- **EAS Update** con canales `development`, `preview`, `production` y `runtimeVersion` por política `fingerprint`. Sólo cambios JS; cualquier cambio nativo pasa por EAS Build y tienda.
- **Sentry** (`@sentry/react-native` con su plugin de Expo) para errores y rendimiento, con subida de source maps en EAS Build/Update y filtrado de PII (no enviar emails, teléfonos ni datos de leads).
- **Analítica de producto:** no hay ninguna hoy. No añadir en el MVP; si se decide, Firebase Analytics sin IDFA (sin ATT).

---

## 4. Arquitectura de la app

### 4.1 Estructura de carpetas (`apps/mobile`)

```text
apps/mobile/
├── app/                              Expo Router
│   ├── _layout.tsx                   Providers: sesión, i18n, tema, Sentry, notificaciones
│   ├── (auth)/login.tsx, register.tsx, reset-password.tsx
│   ├── (app)/_layout.tsx             Guard de sesión (equivalente a AuthGuard)
│   ├── (app)/(tabs)/_layout.tsx      Tabs: Presupuestos, Proyectos, Equipo, Solicitudes
│   ├── (app)/(tabs)/budgets/index.tsx, [budgetId].tsx, new.tsx
│   ├── (app)/(tabs)/projects/index.tsx, [projectId]/index.tsx, [projectId]/history.tsx
│   ├── (app)/(tabs)/team/index.tsx, manage.tsx, jobs/new.tsx
│   ├── (app)/(tabs)/leads/index.tsx, [leadId].tsx
│   ├── (app)/menu/ catalog.tsx, templates/…, estimator.tsx (resumen), profile.tsx,
│   │                account.tsx, password.tsx, delete-account.tsx, help.tsx
│   └── +not-found.tsx
├── src/
│   ├── platform/                     Adaptadores: firebase (RNFB), storage (MMKV), connectivity (NetInfo),
│   │                                 push (messaging + expo-notifications), pdf (fs + sharing), images
│   ├── features/                     Equivalentes móviles de budget-editor, budget-structure, notifications
│   ├── widgets/                      Componentes compuestos por pantalla
│   └── ui/                           Primitivas con @bg/ui-tokens
├── app.config.ts                     Config dinámica por entorno (APP_VARIANT)
└── eas.json
```

Se mantiene la dirección de dependencias de FSD: `app → features/widgets → @bg/app-core → @bg/firebase-api → @bg/domain`; `@bg/domain` no importa nada de plataforma.

### 4.2 Navegación

- **Tabs (orden actual de la web, `docs/architecture.md`):** Presupuestos, Proyectos, Equipo, Solicitudes. Badge en Solicitudes con leads no vistos (sólo si se añade el campo; hoy no existe).
- **Menú (icono de cuenta en la cabecera de las tabs raíz):** Mi empresa, Catálogo, Plantillas, Estimador (resumen), Mi cuenta, Ayuda. Se presenta como pantalla modal con lista, no como drawer.
- **Stacks por tab** con gesto de retroceso nativo; el retorno conserva semana y filtro de Equipo (como hoy con `location.state`).
- **Ruta inicial:** `/projects` en la web (`router.tsx:27`). Proponer abrir en Presupuestos o en la última tab usada (decisión D8).

### 4.3 Offline-first y sincronización

**Cambio de contrato respecto a BG-012 (requiere aprobación, D3):** en web se decidió no activar la persistencia global de Firestore. En móvil se propone activarla porque:

- El almacenamiento es privado de la app (sandbox) y se puede cifrar a nivel de sistema.
- Al cerrar sesión o cambiar de cuenta se ejecuta `terminate()` + `clearPersistence()` y se borra MMKV del UID, conservando la garantía «ninguna cuenta ve datos de otra» (criterio 7 de BG-012).

**Política propuesta:**

| Operación                                                                                                                                       | Fase 1–2                                                                                                                          | Fase 3                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Lecturas                                                                                                                                        | Caché de Firestore + snapshots MMKV de stores (mismo contrato BG-012: sin skeleton offline, `OfflineUnavailable` si no hay datos) | Precarga de proyectos activos y semana actual/siguiente al abrir la app con red                                                                |
| Escrituras simples (`updateDoc` de presupuesto vía `WriteQueue`)                                                                                | Bloqueadas offline con el mismo toast (paridad BG-012)                                                                            | Permitidas: Firestore las encola y se muestran como «pendiente de sincronizar»                                                                 |
| Transacciones (crear presupuesto con cuota, convertir a proyecto, completar partidas, suplementos, asignaciones con `assignmentState.revision`) | Bloqueadas offline (las transacciones de Firestore fallan sin red)                                                                | Siguen bloqueadas, salvo «marcar partida completada» rediseñada como escritura por partida + resumen recalculado en una Function (spec propia) |

Al recuperar la red se mantiene el orden actual: vaciar `WriteQueue`, después refrescar stores y la vista activa.

### 4.4 Auth y sesión

- Email/contraseña con RNFB Auth; sesión persistida por el SDK nativo.
- El coordinador `session.ts` (una suscripción, reinicio de stores por UID, revisión de sesión) se reutiliza vía `@bg/app-core`.
- Cierre de sesión: revocar dispositivo push → borrar token FCM → vaciar `WriteQueue` → limpiar caché de Firestore y MMKV del UID (orden actual de `prepareSignOut`, `session.ts:144`, y BG-010).
- **Eliminación de cuenta in-app** (nueva): reautenticación (`reauthenticateWithCredential`, ya usado en `auth/api/firebase.ts:44`) + callable `deleteAccount` (§5.4).
- Sign in with Apple: **no obligatorio** mientras sólo haya email/contraseña (la guía 4.8 sólo lo exige si hay login con terceros). Si se añade Google, hay que añadir Apple también.

### 4.5 Permisos y planes

- Se mantiene el modelo `free | premium` (`src/shared/types/index.ts:120-126`) y la cuota Free de 3 plazas aplicada por reglas (`FREE_BUDGET_LIMIT`, `utils.ts:5`). La app muestra `BudgetLimitReached` equivalente.
- Mientras BG-004 siga aplazado, la app **no muestra precios, botones de compra ni enlaces a pago** (ver §8.4). El mensaje de límite dice «Has alcanzado el límite de tu plan» sin llamada a comprar.
- Admin no existe en la app; `isAdmin` se ignora en móvil.

---

## 5. Cambios en back (Firebase)

### 5.1 Proyecto y apps

- Registrar apps iOS (`com.budgenerator.app`, bundle a confirmar, D6) y Android (mismo `applicationId`) en el proyecto `budgenerator`; y en un proyecto **separado de staging** (hoy sólo hay `budgenerator` y proyectos `demo-*` de emulador; ver D5).
- `GoogleService-Info.plist` y `google-services.json` por entorno, inyectados como EAS file secrets (no en Git).
- Huellas SHA-1/SHA-256 de Android (debug, upload key y app signing de Play) en Firebase.
- Clave APNs (.p8) subida a Firebase Cloud Messaging.

### 5.2 App Check

- Proveedores: App Attest (iOS, con DeviceCheck de respaldo), Play Integrity (Android), reCAPTCHA Enterprise (web).
- Activar primero en **modo métrico**, después forzar en Firestore y en las callables autenticadas. Las callables públicas del estimador (`getPublicEstimator`, `calculatePublicEstimate`, `submitPublicLead`, `functions/src/index.ts:41-49`) sólo se fuerzan cuando la web pública tenga App Check, para no romper la landing.
- Tokens de depuración para emuladores y CI.

### 5.3 Notificaciones (FCM por plataforma)

1. **Contrato `registerPushDevice`** (`functions/src/notifications/contracts.ts:8`, hoy `{installationId, fid} | {installationId, registrationToken}`): añadir `platform: 'web' | 'ios' | 'android'` y opcionalmente `appVersion`. Las filas existentes sin `platform` se tratan como `web`.
2. **`pushDevices/{installationId}`**: guardar `platform`. El límite `notificationDeviceCounts/{uid}` debe contemplar que una persona tenga PWA + móvil.
3. **`sendPushNotification`** (`fcm.ts:34-41`): construir el mensaje según plataforma:
   - web: igual que hoy (data-only + `webpush`).
   - ios: `notification` con copy fijo (sin contacto ni contenido del lead, como hoy), `apns.payload.aps` con `sound`, `thread-id` y `mutable-content` si se usa; `data: {jobId, leadId}`.
   - android: `notification` + `android.notification.channelId = 'leads'`, `priority: 'high'`.
4. **Recuperación de tokens:** `messaging/registration-token-not-registered` ya se clasifica (`fcm.ts:21-22`) y marca `recoveryRequired`; en nativo la recuperación es `onTokenRefresh` + re-registro, sin la rotación de Firebase Installations de la web.
5. **Tests:** ampliar `tests/fcmDelivery.test.ts` y `tests/leadPush.test.ts` con payloads por plataforma; pruebas de reglas sin cambios (los dispositivos siguen siendo Admin SDK).

### 5.4 Functions nuevas

| Function                                       | Motivo                                                                       | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `deleteAccount` (callable, autenticada)        | Requisito de App Store (5.1.1(v)) y Google Play                              | Borrado recursivo de `users/{uid}` (budgets, projects y subcolecciones, teamMembers, crews, teamJobs, templates, profile, leads, settings, pushDevices), `sharedBudgets` del propietario, `quoteEstimatorLinks/{uid}` y `publicQuoteTokens` asociados, `notificationDeviceCounts/{uid}`, `pushInstallationIndex` del UID; por último `auth.deleteUser(uid)`. Idempotente y reanudable. También se expone en la web (Google exige una URL de solicitud de borrado). |
| Webhook de suscripciones (sólo si se monetiza) | Sincronizar `plan`/`premiumExpiresAt` desde App Store, Play y Stripe         | Escribe con Admin SDK; las reglas ya impiden que el cliente se asigne plan.                                                                                                                                                                                                                                                                                                                                                                                        |
| `onProjectTaskWrite` (fase 3, opcional)        | Recalcular resumen de progreso si se permiten escrituras offline por partida | Requiere spec y cambio de reglas.                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### 5.5 Reglas

- Sin cambios para el MVP (mismos documentos, mismo propietario).
- Si se añaden fotos de obra: `storage.rules` nuevas (por UID y proyecto, tamaño y tipo MIME) y tests contra el emulador de Storage.
- Cualquier cambio de reglas exige tests reales con emuladores (AGENTS.md).

### 5.6 Hosting

- `/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json`, con cabeceras y exclusión del rewrite SPA en `firebase.json`.
- Página pública de política de privacidad y de solicitud de borrado de cuenta (enlazadas desde las fichas de tienda).

---

## 6. Diseño y UX nativo

### 6.1 Adaptación de patrones web

| Patrón web actual                            | Equivalente nativo                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Modal.tsx`, `ConfirmModal.tsx`              | Bottom sheet (`@gorhom/bottom-sheet` o sheet nativo de Expo Router con `presentation: 'formSheet'`) y `Alert`/action sheet para confirmaciones destructivas |
| `SwipeActions.tsx` (gesto propio)            | `ReanimatedSwipeable` de `react-native-gesture-handler`                                                                                                     |
| View Transitions (`page-view-transition.ts`) | Animaciones nativas del stack; sin animación al cambiar de tab (igual que hoy)                                                                              |
| Swipe de semana en Equipo                    | `PagerView` o gesto horizontal con Reanimated; se deshabilita offline (BG-012)                                                                              |
| `InfoPopover.tsx`                            | Tooltip/sheet pequeño                                                                                                                                       |
| `PageHeader` + `BackButton`                  | Header nativo del stack con título grande en iOS                                                                                                            |
| Toasts (`ToastHost.tsx`)                     | Toast propio anclado sobre la tab bar, anunciado con `AccessibilityInfo.announceForAccessibility`                                                           |
| Selects (`Select.tsx`)                       | Picker en sheet con búsqueda                                                                                                                                |
| Fechas `YYYY-MM-DD`                          | `@react-native-community/datetimepicker`; conservar la semántica de día local                                                                               |

### 6.2 Detalles nativos

- **Área segura:** `react-native-safe-area-context` en todas las pantallas; la PWA tenía este punto pendiente de verificar en dispositivo (`docs/plan.md`).
- **Teclado:** `react-native-keyboard-controller` (evitar que tape importes en el editor de presupuesto; toolbar «Siguiente/Hecho» en campos numéricos con teclado `decimal-pad`).
- **Haptics:** `expo-haptics` en marcar partida completada, borrar y confirmar.
- **Pull-to-refresh** en listas (no existe en la web).
- **Menús contextuales** (long press) en filas de presupuesto/proyecto.
- **Modo oscuro:** la web no lo tiene; fuera del MVP, pero los tokens se definen con variante para no cerrarlo.

### 6.3 Tokens compartidos

`@bg/ui-tokens` como fuente de verdad (§3.4): paleta verde/arena actual (`src/index.css:17-40`), Manrope (texto) y Fraunces (display) cargadas con `expo-font`, escala tipográfica, radios y espaciado. Un test compara el CSS generado con el bloque `@theme` para evitar divergencias.

### 6.4 Accesibilidad

- `accessibilityRole`, `accessibilityLabel` y estados en todos los controles; los iconos sin texto (como en la cabecera de Equipo) con etiqueta.
- Dynamic Type / escalado de fuente hasta 200 % sin truncar importes.
- Áreas táctiles ≥ 44×44 pt (iOS) / 48 dp (Android).
- Contraste AA verificado sobre los tokens.
- `reduceMotion` respetado (igual que `prefers-reduced-motion` en la web).
- Pruebas con VoiceOver y TalkBack en el flujo crear presupuesto → exportar PDF.

---

## 7. Calidad

### 7.1 Testing

| Nivel             | Herramienta                                                                                                  | Alcance                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominio           | Vitest (ya en uso) en `packages/domain`                                                                      | Mover los tests puros actuales (`budgetMath`, `catalogSearch`, `catalogTradeImport`, `budgetStructure`, `pdf`, etc.). Se ejecutan una sola vez para web, móvil y Functions. |
| Contrato de datos | Vitest + emuladores                                                                                          | Suite común de `@bg/firebase-api` ejecutada con JS SDK; en móvil, con RNFB en un test de integración del dev client (o, si no es viable, por Maestro contra emulador).      |
| Reglas            | `pnpm test:rules` (sin cambios)                                                                              | Más casos de `deleteAccount` y Storage si aplica.                                                                                                                           |
| Componentes       | Jest (`jest-expo`) + React Native Testing Library                                                            | Pantallas clave, estados offline, accesibilidad básica.                                                                                                                     |
| E2E               | **Maestro** (recomendado frente a Detox: YAML, menos acoplado al build, soporta iOS/Android y EAS Workflows) | Login, crear presupuesto, exportar PDF, marcar partida, recibir push simulado, modo avión. Contra emuladores Firebase con proyecto `demo-*`, nunca datos reales.            |

### 7.2 CI/CD

- **CI de PR** (GitHub Actions): `pnpm -r lint`, `typecheck`, tests de `packages/*`, `pnpm test:rules`, `jest` móvil, `expo-doctor`, comprobación de fingerprint (si cambia, exige build nativo).
- **EAS Build** con perfiles `development` (dev client, simulador y dispositivo interno), `preview` (distribución interna/TestFlight/Internal testing) y `production` (tiendas).
- **EAS Submit** a TestFlight y Play Internal testing sólo bajo instrucción explícita (AGENTS.md: sin despliegues automáticos).
- **EAS Update** para hotfixes JS en `preview` y `production`, con despliegue gradual (rollout por porcentaje) y rollback.
- **EAS Workflows** o GitHub Actions para Maestro en build `preview`.

### 7.3 Entornos

| Variante    | Firebase                        | Bundle/ID                      | Uso                    |
| ----------- | ------------------------------- | ------------------------------ | ---------------------- |
| development | Emuladores (`demo-*`) o staging | `com.budgenerator.app.dev`     | Desarrollo local       |
| preview     | Proyecto staging (nuevo, D5)    | `com.budgenerator.app.preview` | QA, TestFlight interno |
| production  | `budgenerator`                  | `com.budgenerator.app`         | Tiendas                |

`app.config.ts` lee `APP_VARIANT`; las tres apps conviven en un mismo dispositivo. Guardas equivalentes a la web: el build de producción falla si apunta a `demo-*`, y el de emulador si no es `demo-*` (como `config.ts` hoy). Recordar el incidente de `authDomain` de demo en producción (`docs/firebase.md`): añadir una verificación automática del `projectId` en el binario antes de enviar a tienda.

### 7.4 Firma y versionado

- Credenciales gestionadas por EAS (certificado de distribución y perfiles de aprovisionamiento iOS; upload keystore Android con Play App Signing). Copia de seguridad del keystore fuera de EAS.
- `version` semántica compartida con la web cuando el cambio es funcional; `buildNumber`/`versionCode` autoincrementados por EAS (`appVersionSource: remote`).
- `runtimeVersion` por fingerprint para no servir OTA incompatibles.

---

## 8. Publicación

### 8.1 Cuentas

- **Apple Developer Program** (99 USD/año). Recomendable como organización (requiere D-U-N-S) para que el vendedor aparezca como la empresa; como persona física aparece el nombre personal.
- **Google Play Console** (25 USD una vez). Las cuentas personales nuevas deben pasar una prueba cerrada con un mínimo de testers durante 14 días antes de producción (en 2025 eran 12 testers; verificar la cifra vigente). Una cuenta de organización evita ese requisito y exige D-U-N-S.

### 8.2 Requisitos de revisión

| Requisito                                                  | Estado actual                                                                                          | Acción                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eliminación de cuenta in-app (Apple 5.1.1(v), Google Play) | **No existe** (sólo cambio de contraseña)                                                              | `deleteAccount` (§5.4) + pantalla en Mi cuenta + URL web pública de solicitud                                                                                                                              |
| Política de privacidad                                     | El perfil guarda una URL de privacidad para el estimador; no hay política propia de la app documentada | Redactar y publicar en Hosting; enlazar desde la app y las fichas                                                                                                                                          |
| Etiquetas de privacidad (App Store) y Data Safety (Play)   | —                                                                                                      | Declarar: email (cuenta), datos de clientes y leads introducidos por la empresa (nombre, email, teléfono, dirección), identificadores de dispositivo (token push), diagnósticos (Sentry). Sin seguimiento. |
| App Tracking Transparency                                  | No se rastrea                                                                                          | No pedir ATT; no usar IDFA; configurar Sentry/Firebase sin identificadores publicitarios                                                                                                                   |
| Privacy manifest (`PrivacyInfo.xcprivacy`)                 | —                                                                                                      | Lo generan Expo y las librerías; revisar «required reason APIs» (MMKV, file timestamps)                                                                                                                    |
| Cuenta de demostración para revisión                       | —                                                                                                      | Cuenta en producción con datos sintéticos, sin datos reales de clientes                                                                                                                                    |
| Funcionalidad mínima (Apple 4.2)                           | —                                                                                                      | La app aporta push, PDF compartido, offline: no es un simple wrapper web                                                                                                                                   |
| Permisos con texto de propósito                            | —                                                                                                      | Cámara, fotos, notificaciones, en español                                                                                                                                                                  |
| Exportación de cifrado                                     | Sólo HTTPS estándar                                                                                    | `ITSAppUsesNonExemptEncryption = false`                                                                                                                                                                    |
| Target API Android                                         | —                                                                                                      | Cumplir el target SDK exigido por Play en la fecha de envío (Expo lo actualiza por SDK)                                                                                                                    |

### 8.3 Fichas

Capturas en iPhone 6,9", iPad (sólo si se soporta tablet, D9) y Android; textos en español; categoría Negocios/Productividad; clasificación por edades; URL de soporte (`CONTACT_EMAIL`, `utils.ts:4`).

### 8.4 Monetización (BG-004 aplazado)

La propuesta documentada es Free (3 plazas) y Pro a 19,99 €/mes + IVA mediante Stripe (`docs/product.md`). Implicaciones:

- **Apple (guía 3.1.1):** desbloquear funciones o cuota de una app con una suscripción digital exige In-App Purchase. Las excepciones no encajan bien: «reader apps» no aplica; 3.1.3(b) multiplataforma permite acceder a lo comprado en la web **siempre que también se ofrezca por IAP**; 3.1.3(c) «Enterprise» sólo cubre ventas a organizaciones para sus empleados, no autónomos o pequeñas empresas que contratan individualmente (zona gris: no basarse en ella sin consultarlo).
- **Excepciones regionales:** en la tienda de EE. UU., tras la sentencia Epic v. Apple (abril de 2025) se permiten enlaces y botones a compra externa sin comisión; en la UE (DMA) existen condiciones alternativas con comisiones reducidas y requisitos propios. El mercado objetivo es España, así que aplica el régimen UE: verificar las condiciones vigentes al decidir.
- **Google Play:** Play Billing obligatorio para bienes digitales; en el EEE existe el programa de facturación alternativa/«user choice billing» con comisión reducida; en EE. UU. las reglas cambiaron tras Epic v. Google (2025). Verificar en el momento.
- **Comisiones:** 15 % en el Small Business Program de Apple y en suscripciones de Google; Apple aplica 15 % a suscripciones a partir del segundo año.
- **Opciones:**
  1. **Recomendada mientras BG-004 esté aplazado:** app gratuita; las cuentas `premium` existentes (asignadas por administración) funcionan en la app; **ningún texto, precio ni enlace a compra** dentro de la app. Cumple las guías porque no se vende nada en la app.
  2. Al reactivar BG-004: IAP (App Store y Play) + Stripe en web, con **RevenueCat** (o webhooks propios) sincronizando un único `plan` en Firestore mediante Functions. Precio en tienda ajustado por comisión (p. ej., 19,99 € web / 24,99 € en tienda, decisión comercial).
  3. Sólo Stripe con enlace externo bajo las condiciones UE/EE. UU.: posible pero con requisitos y comisiones propias; requiere revisión legal.

---

## 9. Roadmap

Estimaciones para 1 desarrollador a tiempo completo, con margen del 15–20 % incluido. Rangos porque dependen de los spikes de fase 0.

### Fase 0 — Preparación y monorepo (3–4 semanas)

**Entregables**

- Spec aprobada (este documento convertido en `docs/specs/BG-N01-app-nativa.md`) y decisiones D1–D10 cerradas.
- `pnpm-workspace.yaml`; `@bg/domain` extraído con sus tests; Functions importa de `@bg/domain` en lugar de `../../src` (`functions/src/quoteEstimator.ts:10-40`).
- Helpers de fecha y progreso extraídos de componentes (§2.3 A).
- `@bg/i18n`, `@bg/ui-tokens` con generación del `@theme`.
- `apps/mobile` vacía con Expo Router, dev client, EAS configurado, tres variantes.
- **Spikes:** (a) repositorio `project` con RNFB contra emulador; (b) `buildBudgetDocument` en Hermes + compartir; (c) push FCM en iOS y Android con dispositivo físico; (d) persistencia y `clearPersistence` al cambiar de cuenta.

**Criterios de aceptación:** la web pasa `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:rules`, `pnpm build:functions`, `pnpm test:e2e` sin cambios funcionales; dev client arranca en simulador iOS y emulador Android contra emuladores Firebase; informe de spikes con decisión go/fallback.

### Fase 1 — Núcleo (6–8 semanas)

**Entregables:** `@bg/firebase-api` y `@bg/app-core` (stores, `WriteQueue`, red, sesión, caché MMKV); login/registro/recuperación; tabs; Presupuestos (lista, detalle, editor, alta guiada, aceptar, PDF y compartir, enlace público); Proyectos (lista, detalle, marcar partidas, fechas, suplementos); Solicitudes (lista, detalle, borrar, crear presupuesto); Mi cuenta con cerrar sesión; offline de lectura (contrato BG-012).

**Criterios de aceptación:** mismos importes que la web para un conjunto de presupuestos de prueba (test de paridad sobre `budgetTotals`); el PDF móvil y el web son equivalentes página a página para el documento largo de tests; en modo avión las vistas visitadas se muestran sin skeleton y una mutación muestra el toast; cambiar de cuenta no deja datos del UID anterior (test automatizado); Maestro cubre login → presupuesto → PDF.

### Fase 2 — Paridad (5–6 semanas)

**Entregables:** Equipo (planificación semanal con swipe, asignaciones diarias, trabajos puntuales, gestión de personas y cuadrillas); push nativo de solicitudes (cambios de §5.3 en Functions); deep links/universal links; perfil de empresa con logo desde galería; catálogo (búsqueda, edición, importar bibliotecas); plantillas; resumen del estimador; ayuda; **eliminación de cuenta** (Function + UI en web y móvil); Sentry; App Check en modo métrico.

**Criterios de aceptación:** push recibido con la app cerrada en iOS y Android y el toque abre el lead; conflictos de doble asignación iguales a la web (tests de `dailyAssignments` compartidos); `deleteAccount` probado en emulador con datos sintéticos de todas las colecciones; accesibilidad revisada con VoiceOver/TalkBack en los flujos principales.

### Fase 3 — Nativo diferencial (3–4 semanas; cada punto requiere spec propia)

**Entregables candidatos (priorizar en D10):** escrituras offline acotadas (marcar partidas) con indicador de pendiente; precarga offline de proyectos activos; fotos de obra con Cloud Storage y subida diferida; firma del cliente; abrir dirección en Mapas; acciones rápidas (quick actions) e intents de compartir.

**Criterios de aceptación:** definidos en cada spec; ninguna rompe los criterios de BG-012 en web.

### Fase 4 — Publicación (2–3 semanas, más tiempos de revisión)

**Entregables:** cuentas de desarrollador; política de privacidad y página de borrado; etiquetas de privacidad y Data Safety; fichas y capturas; cuenta de revisión; App Check forzado; beta en TestFlight y prueba cerrada de Play (14 días si la cuenta es personal); envío a revisión; EAS Update de producción configurado.

**Criterios de aceptación:** aprobada en ambas tiendas; crash-free ≥ 99,5 % en beta; ninguna prueba sobre datos reales; checklist de publicación registrado en `docs/plan.md`.

**Total:** 19–25 semanas. Camino crítico: spikes de fase 0 → `@bg/firebase-api` → push nativo.

### 9.1 Riesgos y mitigaciones

| Riesgo                                                                     | Impacto                                | Mitigación                                                                                                          |
| -------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Diferencias RNFB vs JS SDK rompen la reutilización de `entities/*/api`     | Duplicar ~1.600 líneas de repositorios | Spike en fase 0; suite de contrato común contra emuladores; fallback de repositorios por plataforma                 |
| jsPDF falla o es lento en Hermes                                           | PDF divergente                         | Spike; fallback `expo-print` con HTML basado en los mismos totales                                                  |
| Persistencia offline de Firestore filtra datos entre cuentas               | Privacidad                             | `terminate` + `clearPersistence` + borrado MMKV en `resetSession`; test automático de cambio de cuenta              |
| Divergencia de reglas de negocio entre web y móvil                         | Importes distintos                     | Dominio único, tests de paridad, Functions sobre el mismo paquete                                                   |
| Rechazo en revisión de Apple (borrado de cuenta, 4.2, metadatos de compra) | Retraso de semanas                     | Borrado de cuenta en fase 2; ninguna mención a precios; cuenta demo preparada                                       |
| Payload data-only no visible en iOS                                        | Avisos perdidos                        | Payload por plataforma (§5.3) y pruebas en dispositivo físico                                                       |
| Migración del monorepo rompe el despliegue de la PWA                       | Producción afectada                    | Monorepo incremental; web en la raíz hasta la beta; verificación byte a byte de Hosting como en despliegues previos |
| Expo SDK cambia durante el desarrollo                                      | Retrabajo                              | Fijar SDK al inicio; actualizar sólo entre fases                                                                    |
| Un solo desarrollador y dos plataformas                                    | Plazo                                  | Priorizar iOS para beta si el público usa iPhone (D9); Android en paralelo con el mismo código                      |
| Coste de App Check/Functions al forzar en callables públicas               | Bloqueo de la landing                  | Modo métrico primero; no forzar en públicas hasta tener App Check web                                               |

### 9.2 Fuera de alcance de esta spec

Integración con Web Factory Lite, BC3, IA (BG-006), landing por empresa, CRM, cuentas para trabajadores, tablet optimizada (salvo D9), modo oscuro, analítica de producto.

### 9.3 Verificaciones requeridas antes de cerrar cada fase

`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:rules` (si hay reglas), `pnpm test:integration` (si hay Functions), tests de `packages/*`, Jest móvil y Maestro en `preview`. Registrar resultados reales en `docs/plan.md` y en la spec, sin inventarlos (AGENTS.md).

### 9.4 Decisiones abiertas

| ID  | Decisión                                                                                  | Recomendación                                   |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| D1  | ¿Aprobar monorepo pnpm incremental (web en raíz hasta la beta)?                           | Sí                                              |
| D2  | ¿RNFB en móvil y JS SDK en web, con repositorios inyectables?                             | Sí, condicionado al spike                       |
| D3  | ¿Activar persistencia de Firestore en móvil (desviación de BG-012 sólo para nativo)?      | Sí, con borrado al cerrar sesión                |
| D4  | ¿Permitir escrituras offline en fase 3 y en qué flujos?                                   | Sólo marcar partidas, con spec propia           |
| D5  | ¿Crear un proyecto Firebase de staging real?                                              | Sí (hoy sólo producción y `demo-*`)             |
| D6  | Bundle ID, nombre en tienda y titular de las cuentas (persona u organización con D-U-N-S) | Organización                                    |
| D7  | Política de monetización en la app mientras BG-004 esté aplazado                          | App gratuita sin compras ni menciones de precio |
| D8  | Tab inicial de la app (Proyectos como la web o Presupuestos)                              | Última tab usada; por defecto Presupuestos      |
| D9  | ¿Plataforma prioritaria y soporte de tablet?                                              | Ambas plataformas; teléfono únicamente en v1    |
| D10 | Priorización de fase 3 (offline escritura, fotos, firma, mapas)                           | Offline de partidas y fotos primero             |

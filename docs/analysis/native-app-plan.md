# BG-014 — Plan de app nativa iOS/Android (React Native + Expo)

> **Estado: análisis de apoyo de la spec [BG-014](../specs/BG-014-app-nativa.md).** La spec recoge el contrato (alcance, decisiones, criterios y plan); este documento conserva el detalle técnico y la justificación. La spec se aprobó el 14-11-2026; despliegues, envíos a tienda y cambios de reglas siguen necesitando instrucción explícita (AGENTS.md). Redactado el 11-11-2026 sobre `59d00d2` (con el identificador provisional BG-N01) y actualizado el 14-11-2026 sobre `main` (`57129b7`), tras la integración del 13-11-2026 y con las decisiones D1–D10 resueltas (§9.4).

## 0. Resumen ejecutivo

- **Qué:** una app nativa iOS/Android de BudGenerator para la empresa de reformas (usuario autenticado), construida con Expo (dev client + CNG) y Expo Router, que reutiliza el dominio TypeScript existente y el mismo proyecto Firebase.
- **Por qué:** push fiable en iOS (hoy depende de PWA instalada y Web Push), fotos de obra, PDF compartido con el share sheet nativo, uso real sin conexión en obra y presencia en las tiendas.
- **Cómo:** monorepo pnpm **incremental** (la web se queda en la raíz al principio), paquete `@bg/domain` con la lógica pura ya existente (incluido el modelo canónico BC3 de `construction-document`), `@react-native-firebase` en móvil y Firebase JS SDK en web.
- **Cuánto:** ~18–23 semanas de 1 desarrollador hasta publicación en ambas tiendas (detalle en §9). Núcleo en beta interna a las ~9–12 semanas (fases 0–1) y MVP completo con push nativo a las ~13–17 (fase 2). La integración del 13-11-2026 ya resolvió en el back el borrado y la exportación de cuenta, el payload push por plataforma, App Check en modo observación y los textos legales plantilla, y retiró i18next.
- **Decisiones:** D1–D10 resueltas el 14-11-2026 (§9.4). Monorepo incremental, RNFB, persistencia offline sólo en nativo, app gratuita y sin proyecto de staging. Queda aplazada D6 (titular de las cuentas de tienda) hasta antes de la fase 4.

---

## 1. Objetivos y alcance

### 1.1 Valor frente a la PWA actual

| Necesidad                | Situación PWA (evidencia)                                                                                                                                                                                                                                                                                                                                                                                                                            | Aporte nativo                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Avisos de solicitudes    | Web Push sólo funciona en iOS con la PWA instalada; varios incidentes de entrega documentados en `docs/firebase.md` (FID no registrados, `recoveryRequired`, recuperación manual de la instalación). Lógica compleja en `src/features/notifications/model/push.ts` (347 líneas). El back ya construye el payload por plataforma (`buildPushMessage`, `functions/src/notifications/fcm.ts`), pero ningún cliente registra todavía `ios` ni `android`. | APNs/FCM nativos, entrega con la app cerrada, canales Android, deep link directo al lead.                      |
| Consulta en obra sin red | BG-012 sólo conserva lo ya consultado y **bloquea toda mutación offline** (`docs/specs/BG-012-modo-offline.md`, criterio 8).                                                                                                                                                                                                                                                                                                                         | Caché persistente nativa de Firestore y, en fase 3, escrituras offline acotadas (marcar partidas completadas). |
| Fotos de obra            | No existe Storage (`docs/firebase.md`: «No hay Storage»). El logo vive como data URL en `profile/data`.                                                                                                                                                                                                                                                                                                                                              | Cámara y galería con compresión, subida diferida a Cloud Storage. Funcionalidad nueva: requiere spec propia.   |
| Enviar el PDF al cliente | `ExportPdfButton` abre una ventana o descarga (`generateBudgetPdf`, `src/shared/lib/pdf.ts:248`).                                                                                                                                                                                                                                                                                                                                                    | Share sheet nativo (WhatsApp, Mail, AirDrop) con el PDF generado en el dispositivo.                            |
| Firma del cliente        | No existe.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Firma en pantalla sobre el presupuesto aceptado (fase 3, opcional; requiere spec).                             |
| Geolocalización          | No existe.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Abrir la obra en Mapas desde la dirección del proyecto (bajo coste); fichaje por ubicación queda fuera.        |
| Distribución             | Instalación manual de la PWA (`src/app/pwaInstall.ts`).                                                                                                                                                                                                                                                                                                                                                                                              | App Store / Google Play, actualizaciones OTA.                                                                  |

### 1.2 MVP nativo (fases 1–2) frente a paridad

**MVP nativo (lo que justifica publicar):**

1. Login, registro (con aceptación de condiciones versionada, `LEGAL_TERMS_VERSION` de `src/shared/lib/legal.ts`), verificación de email y recuperación de contraseña (email/contraseña, igual que hoy: `src/entities/auth/api/firebase.ts`). La verificación es obligatoria para crear enlaces públicos.
2. Presupuestos: lista, detalle, edición de partidas/conceptos sobre el modelo canónico BC3 (`entities/construction-document`), alta guiada desde catálogo (`features/budget-structure`), aceptación, exportar/compartir PDF, compartir enlace público.
3. Proyectos: lista, detalle, marcar partidas, fechas de finalización, suplementos y anulaciones, historial de progreso.
4. Equipo: planificación semanal, asignaciones diarias, trabajos puntuales; gestión de personas y cuadrillas.
5. Solicitudes: bandeja, detalle, borrar, crear presupuesto desde lead; **push nativo**.
6. Mi cuenta: perfil de empresa (logo desde galería), preferencias de avisos, cambio de contraseña, **eliminación de cuenta** (obligatoria en tiendas; reutiliza la callable `deleteAccount`, que ya existe con reautenticación reciente) y enlace a la exportación de datos.
7. Consulta offline de lo ya sincronizado.

**Paridad (fase 2 tardía):** catálogo completo con importación de bibliotecas (`TRADE_CATALOGS`), plantillas, ayuda, tour inicial adaptado.

### 1.3 Qué se queda sólo en web

| Módulo                              | Ruta actual                                                                           | Motivo                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Administración                      | `/admin` (`src/pages/admin/AdminPage.tsx`, `src/app/AdminGuard.tsx:7`)                | Uso interno, una sola identidad; no aporta en tienda y aumenta la superficie de revisión.                                                                    |
| Configuración del estimador público | `/estimator` (`src/pages/quote-estimator/QuoteEstimatorSettingsPage.tsx`, 763 líneas) | Configuración puntual de tarifas por estancia; en móvil se muestra un resumen (estado, copiar/compartir enlace, revocar) y un enlace «Configurar en la web». |
| Estimador público del visitante     | `/solicitar-presupuesto/:token`                                                       | Lo usa un tercero sin cuenta desde la landing de la empresa.                                                                                                 |
| Visor público de presupuesto        | `/shared/:token`                                                                      | Lo abre el cliente final; no debe exigir instalar la app.                                                                                                    |
| Enlaces cortos y avisos públicos    | `/p/:slug`, `/aviso-privacidad/:noticeId`, `/legal/:document`                         | Los usan terceros o son textos legales; se enlazan desde la app pero se abren en el navegador.                                                               |
| Edición masiva de catálogo (fase 1) | `/catalog`                                                                            | Pantalla densa; en fase 1 sólo lectura/búsqueda y selección, edición en fase 2.                                                                              |
| Importar y exportar BC3             | `features/bc3-exchange` (Catálogo, Presupuestos y Plantillas)                         | Intercambio de ficheros con Presto, Arquímedes o TCQ, propio de escritorio. El modelo BC3 sí se comparte: es el formato de los presupuestos en ambas apps.   |
| Exportación de datos de la cuenta   | `/account` (`exportAccount`)                                                          | Descarga un fichero JSON; la app enlaza a la web.                                                                                                            |

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

**Evidencia de que ya existe una dependencia compartida de facto:** Functions importa código de la app web por ruta relativa: `functions/src/quoteEstimator.ts` importa `../../src/shared/types`, `../../src/entities/construction-document/model` y `../../src/entities/quote-estimator/model/{estimate,types,leads,sharing}`; `privacyNotice.ts` y `notifications/preferences.ts` importan tipos de `src/shared/types`. Es un monorepo implícito sin límites declarados.

### 2.2 Recomendación: monorepo pnpm incremental

Estructura objetivo:

```text
/                         (raíz: pnpm-workspace.yaml, firebase.json, firestore.rules, tests de reglas)
├── apps/
│   ├── web/              (PWA actual; se mueve en el paso 0.4, no antes)
│   └── mobile/           (Expo)
├── packages/
│   ├── domain/           (@bg/domain: tipos, modelo BC3, cálculos, catálogo, estimador, proyectos, planificación, fechas, textos)
│   ├── firebase-api/     (@bg/firebase-api: contratos de datos y repositorios con SDK inyectado)
│   ├── app-core/         (@bg/app-core: stores Zustand, WriteQueue, red, sesión con puertos de plataforma)
│   └── ui-tokens/        (@bg/ui-tokens: colores, tipografía, radios, espaciado)
└── functions/            (se mantiene; pasa a depender de @bg/domain en vez de ../../src)
```

**Por qué incremental:** mover la PWA a `apps/web` toca `vite.config.ts`, `tsconfig*.json` (alias `@/`), `firebase.json` (`hosting.public: dist`), `scripts/build-sw.mjs`, `scripts/deploy.mjs`, `playwright.config.ts`, tres configs de Vitest y el CI. Hacerlo a la vez que se extrae el dominio multiplica el riesgo sobre una app en producción. Por eso:

1. Paso 0.1: añadir `pnpm-workspace.yaml` con `packages/*` y `apps/mobile`, **web en la raíz**.
2. Paso 0.2: extraer `@bg/domain` y hacer que web y Functions importen de él (re-exportando desde las rutas antiguas para minimizar el diff).
3. Paso 0.3: extraer `@bg/ui-tokens`. Los textos no necesitan paquete propio: i18next se retiró y `t()` es un lookup síncrono sobre `translation.json` (`src/shared/i18n/index.ts`) que viaja con `@bg/domain`.
4. Paso 0.4 (opcional, cuando la app móvil esté en beta): mover la web a `apps/web`.

**Coste estimado de migración de la PWA:** pasos 0.1–0.3 ≈ 1,5–2 semanas; paso 0.4 ≈ 0,5–1 semana adicional. Criterio de aceptación: `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:rules`, `pnpm build:functions` y `pnpm test:e2e` sin cambios de comportamiento; mismo hash de contenido del PDF de referencia de `tests/pdf.test.ts`.

### 2.3 Inventario de extracción

#### A. Puro TS, extraíble tal cual a `@bg/domain` (sin DOM ni Firebase)

Líneas por carpeta `model/` en `57129b7`.

| Módulo                                                                                     | Líneas | Notas                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/types/`                                                                        | —      | Contratos de datos; `UserPlan`.                                                                                            |
| `src/entities/construction-document/model/`                                                | 1.795  | **Modelo canónico BC3** (FIEBDC): tipos, decimales, mediciones, operaciones, invariantes, proyección. Sin imports de `@/`. |
| `src/shared/lib/budgetMath.ts`, `format.ts`, `dateKey.ts`, `charset.ts`, `text.ts`         | —      | Importes (`money`, `taskAmount`, `budgetTotals`, `assertBudget`), formato, claves de fecha y semana.                       |
| `src/shared/lib/logoImage.ts`                                                              | —      | `fitWithin` y `encodeLogo` son puros; sólo `canvasLogoEncoder` es web.                                                     |
| `src/entities/budget/model/`                                                               | 798    | Serialización y DTO público con lista explícita de campos.                                                                 |
| `src/entities/catalog/model/`                                                              | 1.595  | Catálogo jerárquico, bibliotecas `TRADE_CATALOGS`, búsqueda e importación por oficio.                                      |
| `src/entities/project/model/`                                                              | 1.227  | Conversión, progreso, suplementos, conflictos diarios (`dailyAssignments.ts`).                                             |
| `src/entities/quote-estimator/model/`                                                      | 657    | Ya compartido con Functions (`estimate`, `leads`, `sharing`, `types`).                                                     |
| `src/entities/workforce/model/`                                                            | 455    | Validación de trabajos puntuales y snapshots.                                                                              |
| `src/features/budget-structure/model.ts`, `src/features/notifications/model/navigation.ts` | —      | Alta guiada desde catálogo y validación de `leadId` en enlaces.                                                            |
| `src/pages/help/helpContent.ts`, `public/locales/es/translation.json`                      | —      | Contenido de ayuda y textos con su lookup `t()`.                                                                           |

**Requieren un ajuste mínimo antes de extraer:**

- `src/shared/lib/utils.ts`: mezcla dominio (`FREE_BUDGET_LIMIT`, `formatCurrency`, `generateId`) con estilo web (`cn` con `clsx`/`tailwind-merge`). Separar `cn` en la web. `generateId` usa `crypto.randomUUID()`: en RN requiere `expo-crypto` (`randomUUID`) inyectado o polyfill.
- Helpers que siguen en componentes o duplicados: `workItemProgress` en `ProjectDetailPage.tsx` y un `localDateKey` privado en `dailyAssignments.ts` que repite `toDateKey` de `dateKey.ts`. Mover a `@bg/domain` con tests.
- `src/pages/catalogs/catalogSummary.ts` y `src/pages/workforce/crewColors.ts`: dependen de `t` o de colores; pasar a `@bg/domain` con inyección de textos/colores.
- `src/shared/lib/pdf.ts`: `buildBudgetDocument` (`:47`) es portable (jsPDF + cálculos); sólo la carga del logo con `Image` y `generateBudgetPdf` (`:248`, ventana o `URL.createObjectURL`) son web. Ver §3.8.

#### B. Portable con puertos de plataforma → `@bg/app-core`

| Módulo                                                                                                  | Dependencia de plataforma                                                                                                                                        | Puerto                                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/shared/lib/writeQueue.ts` (debounce 700 ms, `:17`)                                                 | Ninguna (Zustand)                                                                                                                                                | —                                                            |
| `src/shared/model/session.ts`, `sync.ts`, `toast.ts`                                                    | Ninguna                                                                                                                                                          | —                                                            |
| `src/shared/lib/networkMutation.ts`                                                                     | Ninguna directa                                                                                                                                                  | —                                                            |
| `src/shared/model/network.ts`                                                                           | `navigator.onLine` (`:15-16`, ya con guarda `typeof`)                                                                                                            | `ConnectivityPort` → `@react-native-community/netinfo`       |
| `src/shared/lib/memoryResourceCache.ts`                                                                 | Persiste vía `offlineStateCache`                                                                                                                                 | `KeyValueStore`                                              |
| `src/shared/lib/offlineStateCache.ts`                                                                   | IndexedDB (`:22-27`)                                                                                                                                             | `KeyValueStore` → MMKV (o SQLite si el volumen lo pide)      |
| Stores `entities/*/model/store.ts` (auth, budget, catalog, profile, project, template, user, workforce) | Importan `@/shared/firebase` o su `api`; `budget/model/store.ts` usa `sessionStorage` para drafts; `profile/model/store.ts` usa `canvas` para normalizar el logo | `DraftStorage`, `ImageNormalizer`, inyección de repositorios |
| `src/app/session.ts` (`resetSession`, `loadSession`, `probeSessionConnection`, `prepareSignOut`)        | Firebase `User` y stores                                                                                                                                         | Inyección de repositorios                                    |

#### C. Dependiente del Firebase Web SDK → `@bg/firebase-api` con SDK inyectado

`src/shared/firebase/` (`app.ts` con App Check web, `config.ts` con `import.meta.env`, `getAuth`, `getFirestore`, emuladores), y todos los `entities/*/api/*.ts`: auth (incluye verificación de email, reautenticación, `deleteAccount` y `exportAccount`), budget (incluye `acceptance.ts`), catalog, notifications (callables), profile, project (~1.000 líneas), quote-estimator, template, user, workforce.

**Punto a favor:** `project` y `workforce` ya usan inyección (`createProjectFirestoreApi(database)` en `src/entities/project/api/firestore.ts:125`, `createWorkforceFirestoreApi(database)` en `src/entities/workforce/api/firestore.ts:60`). El resto importa la instancia de `@/shared/firebase` (8 módulos) y debe migrar al mismo patrón.

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

**Decisión (D2): RNFB en móvil (`app`, `auth`, `firestore`, `functions`, `messaging`, `app-check`; `crashlytics` opcional si no se usa Sentry), JS SDK en web.** Push y App Check nativos no son posibles con el JS SDK, y la persistencia offline es el principal valor diferencial. Las callables viven en `europe-southwest1` (`FUNCTION_REGION`, `functions/src/core/config.ts`): el cliente móvil debe instanciar Functions con esa región, igual que la web.

**Cómo compartir los repositorios de datos:** `@bg/firebase-api` exporta factorías `createXxxApi(sdk)` que reciben un objeto mínimo con las funciones que usan (`doc`, `getDoc`, `setDoc`, `updateDoc`, `runTransaction`, `collection`, `query`, `where`, `getDocs`, `serverTimestamp`, `httpsCallable`). Web inyecta `firebase/firestore`; móvil inyecta `@react-native-firebase/firestore`. **Spike obligatorio en fase 0** (2–3 días): portar `project/api/firestore.ts` y ejecutar los mismos tests contra el emulador desde ambos SDK. Si las diferencias de tipos lo hacen inviable, fallback: repositorios separados por plataforma con una **suite de contrato común** ejecutada contra emuladores.

### 3.3 Estado

Reutilizar **Zustand 5** y los stores existentes vía `@bg/app-core`, con la protección de revisión de sesión (`docs/state-and-cache.md`) y `WriteQueue`. Sustituir:

- `offlineStateCache` (IndexedDB) → adaptador MMKV con el mismo particionado por UID y `deleteOfflineUserData(uid)` (`offlineStateCache.ts:179`).
- Drafts en `sessionStorage` (`budget/model/store.ts`) → MMKV con clave por UID; se borran igual al descartar, guardar o cerrar sesión.
- Red → NetInfo + estado de Firestore.

### 3.4 Estilos y tokens

| Opción                            | Pros                                                    | Contras                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NativeWind (v4/v5)                | Clases Tailwind familiares; reutiliza nombres de tokens | Soporte de Tailwind 4 en NativeWind todavía en maduración a mi fecha de corte; capa extra de compilación; las clases web no se copian 1:1 (sin `hover`, grid limitado) |
| `StyleSheet` + tokens compartidos | Sin dependencias; rendimiento predecible; tipado        | Más verboso                                                                                                                                                            |

**Recomendación: `StyleSheet` + `@bg/ui-tokens`, con un pequeño set de primitivas propias (`Text`, `Button`, `Card`, `Sheet`, `ListRow`) que replican las de `src/shared/ui`.** Los componentes web no se reutilizan de todos modos y evita depender de la compatibilidad de NativeWind con Tailwind 4. La web ya usa tokens semánticos (`ink`, `canvas`, `line-strong`…) en CSS por capas; `@bg/ui-tokens` exporta esos mismos tokens como objeto TS (colores, fuentes Manrope/Fraunces, radios, espaciado) y **genera** el bloque `@theme` de la web mediante un script, de modo que la fuente de verdad es única. Reabrir la decisión si NativeWind publica soporte estable de Tailwind 4 antes de la fase 1.

### 3.5 Formularios

Los formularios web son controlados con estado local, sin librería. Para móvil: **react-hook-form** sólo en formularios largos (perfil de empresa, alta de trabajo puntual `NewTeamJobForm.tsx`, 450 líneas) y estado local en el resto; validación con las funciones ya existentes de `@bg/domain` (p. ej. `workforce/model/validation.ts`, `assertBudget`), sin añadir Zod salvo necesidad demostrada. Teclado: `react-native-keyboard-controller`.

### 3.6 Listas

**FlashList** para presupuestos, proyectos, solicitudes, catálogo (miles de partidas en `baseCatalogs.ts`) y roster. `SectionList`/FlashList con cabeceras para capítulos del presupuesto.

### 3.7 Almacenamiento local

- **react-native-mmkv**: snapshots offline por UID, drafts, preferencias de UI, cola de revocación de dispositivos (equivalente a `PENDING_REVOCATIONS_KEY` de `push.ts`).
- **expo-secure-store**: identificador de instalación del dispositivo (equivalente a `INSTALLATION_KEY` de `push.ts`) y cualquier secreto local. No se guardan contraseñas.
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
- **Payload:** ya resuelto en el back. `buildPushMessage` (`functions/src/notifications/fcm.ts`) mantiene data-only + `webpush` para web y, para `ios` y `android`, añade bloque `notification` con copy fijo, canal `leads`, prioridad alta y opciones APNs. Ver §5.3.

### 3.10 Textos

i18next se retiró el 13-11-2026: la app sólo está en español y `src/shared/i18n/index.ts` es un lookup síncrono `t()` sobre `public/locales/es/translation.json` con plurales vía `Intl.PluralRules`. Las pantallas nuevas escriben el texto en español directamente (constantes `copy.ts` si se repite). En móvil se reutiliza el mismo `t()` desde `@bg/domain` para las claves existentes, sin dependencias. Fechas e importes con `Intl` (Hermes incluye `Intl`; verificar `es-ES` y `PluralRules` en Android).

### 3.11 Cámara e imagen

`expo-image-picker` (galería y cámara), `expo-image-manipulator` (redimensionar/comprimir; sustituye el `canvas` de `profile/model/store.ts` para el logo, reutilizando `fitWithin` y los límites de `logoImage.ts`), `expo-image` para mostrar. Fotos de obra (fase 3) requieren Cloud Storage y spec propia.

### 3.12 Enlaces y deep links

- **Esquema** `budgenerator://` para OAuth futuro y pruebas.
- **Universal Links / App Links** en `budgenerator.web.app` (o dominio propio si existe): `apple-app-site-association` y `assetlinks.json` en `/.well-known/` servidos por Hosting (añadir cabecera `Content-Type: application/json` en `firebase.json`).
- **Rutas que abre la app:** `/profile/solicitudes?leadId=…` (notificaciones), `/projects/:id`, `/budget/:id`, acción de restablecer contraseña.
- **Rutas que siguen en web:** `/shared/:token`, `/solicitar-presupuesto/:token`, `/p/:slug`, `/aviso-privacidad/:noticeId` y `/legal/:document` (excluidas en AASA con `"exclude": true`), porque las usan terceros o son textos legales.
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
│   ├── _layout.tsx                   Providers: sesión, tema, Sentry, notificaciones
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
- **Ruta inicial (D8):** la última tab usada, guardada en MMKV por UID; la primera vez, Presupuestos. La web sigue abriendo en `/projects`.

### 4.3 Offline-first y sincronización

**Cambio de contrato respecto a BG-012 (aprobado en D3, sólo para nativo):** en web se decidió no activar la persistencia global de Firestore. En móvil se propone activarla porque:

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
- Registro con aceptación de condiciones (`markLegalAcceptance` y `LEGAL_TERMS_VERSION`, `src/shared/lib/legal.ts`) y aviso de verificación de email equivalente a `EmailVerificationNotice`; la verificación es requisito para compartir enlaces públicos y publicar el estimador.
- Cierre de sesión: revocar dispositivo push → borrar token FCM → vaciar `WriteQueue` → limpiar caché de Firestore y MMKV del UID (orden actual de `prepareSignOut` en `src/app/session.ts` y BG-010).
- **Eliminación de cuenta in-app:** reautenticación (`reauthenticateWithCredential`, ya usado en `auth/api/firebase.ts`) + callable `deleteAccount`, que ya existe y exige un inicio de sesión reciente (§5.4). La UI web de referencia es `features/account/ui/AccountDataSection.tsx`.
- Sign in with Apple: **no obligatorio** mientras sólo haya email/contraseña (la guía 4.8 sólo lo exige si hay login con terceros). Si se añade Google, hay que añadir Apple también.

### 4.5 Permisos y planes

- Se mantiene el modelo `free | premium` (`src/shared/types`) y la cuota Free de 3 plazas aplicada por reglas (`FREE_BUDGET_LIMIT`, `utils.ts`). La app muestra `BudgetLimitReached` equivalente.
- Mientras BG-004 siga aplazado (D7), la app **no muestra precios, botones de compra ni enlaces a pago** (ver §8.4). El mensaje de límite dice «Has alcanzado el límite de tu plan» sin llamada a comprar.
- Admin no existe en la app. El rol admin es ahora un custom claim (`admin`) y `accountData.isAdmin` es sólo informativo; la app ignora ambos.

---

## 5. Cambios en back (Firebase)

### 5.1 Proyecto y apps

- Registrar apps iOS (`com.budgenerator.app`, provisional hasta D6) y Android (mismo `applicationId`) en el proyecto `budgenerator`, más las variantes `.dev` y `.preview`. **No se crea proyecto de staging (D5):** el alias `staging` de `.firebaserc` sigue con su id de ejemplo y no se usa para la app.
- `GoogleService-Info.plist` y `google-services.json` por variante, inyectados como EAS file secrets (no en Git). Con emuladores se usa un fichero con `projectId` `demo-*`.
- Huellas SHA-1/SHA-256 de Android (debug, upload key y app signing de Play) en Firebase.
- Clave APNs (.p8) subida a Firebase Cloud Messaging.

### 5.2 App Check

- **Estado actual:** la web inicializa App Check con reCAPTCHA v3 o Enterprise (`src/shared/firebase/app.ts`) y las Functions leen `APP_CHECK_MODE` (`off | monitor | enforce`, por defecto `monitor`, `functions/src/core/config.ts`).
- **Para nativo:** registrar App Attest (iOS, con DeviceCheck de respaldo) y Play Integrity (Android) para las apps nuevas e inicializar `@react-native-firebase/app-check` antes de la primera llamada.
- Mantener `monitor` hasta comprobar en las métricas que web y móvil envían tokens válidos; después pasar a `enforce` en las callables autenticadas y en Firestore. Las públicas del estimador sólo se fuerzan cuando la landing esté verificada.
- Tokens de depuración para emuladores y CI.

### 5.3 Notificaciones (FCM por plataforma)

**Ya implementado en `main` (13-11-2026):**

- `registerPushDevice` acepta `platform: 'web' | 'ios' | 'android'` opcional (`functions/src/notifications/contracts.ts`); las filas sin `platform` se tratan como `web`.
- `buildPushMessage` (`functions/src/notifications/fcm.ts`) construye el mensaje por plataforma: web data-only + `webpush`; iOS y Android con `notification` de copy fijo (sin datos personales), `android.notification.channelId = 'leads'`, prioridad alta y APNs con `sound` y `threadId`; `data: {jobId, leadId, type}` en todas.
- `messaging/registration-token-not-registered` se clasifica y marca `recoveryRequired`.

**Pendiente para la app:**

1. El cliente nativo registra el token FCM con `platform: 'ios' | 'android'` (la web envía `'web'` desde `push.ts`). Valorar añadir `appVersion` al contrato.
2. Revisar que el límite `notificationDeviceCounts/{uid}` admite PWA + móvil de la misma persona.
3. Recuperación en nativo: `onTokenRefresh` + re-registro, sin la rotación de Firebase Installations de la web.
4. Canal Android `leads` creado por la app antes del primer aviso.
5. Prueba en dispositivo físico de iOS y Android con la app cerrada, contra `budgenerator` con una cuenta sintética (D5).

### 5.4 Functions

**Ya existen:** `deleteAccount` (exige inicio de sesión reciente; borra recursivamente `users/{uid}`, `sharedBudgets`, enlaces cortos, tokens públicos del estimador, `pushInstallationIndex`, `leadNotificationJobs` y `notificationDeviceCounts` del UID, y después el usuario de Auth) y `exportAccount` (`functions/src/account/account.ts`). Cubren el requisito 5.1.1(v) de Apple y el de Google Play; la web ya ofrece borrar la cuenta en `/account`, que sirve como URL de solicitud de borrado para Play. Si se añaden fotos de obra (fase 3), `deleteAccount` debe borrar también sus ficheros de Storage.

**Nuevas:**

| Function                                       | Motivo                                                                       | Notas                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Webhook de suscripciones (sólo si se monetiza) | Sincronizar `plan`/`premiumExpiresAt` desde App Store, Play y Stripe         | Fuera de la v1 (D7). Escribe con Admin SDK; las reglas ya impiden que el cliente se asigne plan. |
| `onProjectTaskWrite` (fase 3, opcional)        | Recalcular resumen de progreso si se permiten escrituras offline por partida | Requiere spec y cambio de reglas.                                                                |

### 5.5 Reglas

- Sin cambios para el MVP (mismos documentos, mismo propietario).
- Si se añaden fotos de obra: `storage.rules` nuevas (por UID y proyecto, tamaño y tipo MIME) y tests contra el emulador de Storage.
- Cualquier cambio de reglas exige tests reales con emuladores (AGENTS.md).

### 5.6 Hosting

- `/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json`, con cabeceras y exclusión del rewrite SPA en `firebase.json`.
- Textos legales: ya existen como plantilla en `/legal/:document` (`src/pages/legal/legalContent.ts`), con la aceptación versionada en el registro. Falta la revisión legal (tarea del propietario en `docs/plan.md`) y añadir los datos que trata la app (token push, diagnósticos, fotos si se activan). Se enlazan desde la app y las fichas de tienda.

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

`@bg/ui-tokens` como fuente de verdad (§3.4): tokens semánticos actuales de la web (`src/index.css` y sus capas), Manrope (texto) y Fraunces (display) cargadas con `expo-font`, escala tipográfica, radios y espaciado. Un test compara el CSS generado con el bloque `@theme` para evitar divergencias.

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
| Dispositivo       | Manual, guiado por checklist                                                                                 | Push con la app cerrada, App Check y compartir PDF en iOS y Android físicos, contra `budgenerator` con cuentas sintéticas (no hay staging, D5).                             |

### 7.2 CI/CD

- **CI de PR** (GitHub Actions): `pnpm -r lint`, `typecheck`, tests de `packages/*`, `pnpm test:rules`, `jest` móvil, `expo-doctor`, comprobación de fingerprint (si cambia, exige build nativo).
- **EAS Build** con perfiles `development` (dev client, simulador y dispositivo interno), `preview` (distribución interna/TestFlight/Internal testing) y `production` (tiendas).
- **EAS Submit** a TestFlight y Play Internal testing sólo bajo instrucción explícita (AGENTS.md: sin despliegues automáticos).
- **EAS Update** para hotfixes JS en `preview` y `production`, con despliegue gradual (rollout por porcentaje) y rollback.
- **EAS Workflows** o GitHub Actions para Maestro en build `preview`.

### 7.3 Entornos

| Variante    | Firebase                                                             | Bundle/ID                      | Uso                    |
| ----------- | -------------------------------------------------------------------- | ------------------------------ | ---------------------- |
| development | Emuladores (`demo-*`)                                                | `com.budgenerator.app.dev`     | Desarrollo local       |
| preview     | Emuladores o `budgenerator` con cuentas sintéticas (sin staging, D5) | `com.budgenerator.app.preview` | QA, TestFlight interno |
| production  | `budgenerator`                                                       | `com.budgenerator.app`         | Tiendas                |

`app.config.ts` lee `APP_VARIANT`; las tres apps conviven en un mismo dispositivo. Sin proyecto de staging (D5), una build `preview` contra `budgenerator` sólo se usa con cuentas sintéticas creadas para la prueba y que se borran al terminar con `deleteAccount`; nunca con cuentas ni datos de clientes. Guardas equivalentes a la web: el build de producción falla si apunta a `demo-*`, y el de emulador si no es `demo-*` (como `config.ts` hoy). Recordar el incidente de `authDomain` de demo en producción (`docs/firebase.md`): añadir una verificación automática del `projectId` en el binario antes de enviar a tienda.

### 7.4 Firma y versionado

- Credenciales gestionadas por EAS (certificado de distribución y perfiles de aprovisionamiento iOS; upload keystore Android con Play App Signing). Copia de seguridad del keystore fuera de EAS.
- `version` semántica compartida con la web cuando el cambio es funcional; `buildNumber`/`versionCode` autoincrementados por EAS (`appVersionSource: remote`).
- `runtimeVersion` por fingerprint para no servir OTA incompatibles.

---

## 8. Publicación

### 8.1 Cuentas

Titular, bundle ID definitivo y nombre en tienda se deciden antes de la fase 4 (D6). Si se elige organización, pedir el D-U-N-S con antelación porque puede tardar semanas.

- **Apple Developer Program** (99 USD/año). Recomendable como organización (requiere D-U-N-S) para que el vendedor aparezca como la empresa; como persona física aparece el nombre personal.
- **Google Play Console** (25 USD una vez). Las cuentas personales nuevas deben pasar una prueba cerrada con un mínimo de testers durante 14 días antes de producción (en 2025 eran 12 testers; verificar la cifra vigente). Una cuenta de organización evita ese requisito y exige D-U-N-S.

### 8.2 Requisitos de revisión

| Requisito                                                  | Estado actual                                                                | Acción                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eliminación de cuenta in-app (Apple 5.1.1(v), Google Play) | `deleteAccount` y la sección de datos de `/account` ya existen en la web     | Pantalla en Mi cuenta de la app sobre la misma callable; `/account` como URL web de solicitud                                                                                                              |
| Política de privacidad                                     | Textos legales plantilla en `/legal/:document`, pendientes de revisión legal | Revisar, añadir los datos que trata la app y enlazar desde la app y las fichas                                                                                                                             |
| Etiquetas de privacidad (App Store) y Data Safety (Play)   | —                                                                            | Declarar: email (cuenta), datos de clientes y leads introducidos por la empresa (nombre, email, teléfono, dirección), identificadores de dispositivo (token push), diagnósticos (Sentry). Sin seguimiento. |
| App Tracking Transparency                                  | No se rastrea                                                                | No pedir ATT; no usar IDFA; configurar Sentry/Firebase sin identificadores publicitarios                                                                                                                   |
| Privacy manifest (`PrivacyInfo.xcprivacy`)                 | —                                                                            | Lo generan Expo y las librerías; revisar «required reason APIs» (MMKV, file timestamps)                                                                                                                    |
| Cuenta de demostración para revisión                       | —                                                                            | Cuenta en producción con datos sintéticos, sin datos reales de clientes                                                                                                                                    |
| Funcionalidad mínima (Apple 4.2)                           | —                                                                            | La app aporta push, PDF compartido, offline: no es un simple wrapper web                                                                                                                                   |
| Permisos con texto de propósito                            | —                                                                            | Cámara, fotos, notificaciones, en español                                                                                                                                                                  |
| Exportación de cifrado                                     | Sólo HTTPS estándar                                                          | `ITSAppUsesNonExemptEncryption = false`                                                                                                                                                                    |
| Target API Android                                         | —                                                                            | Cumplir el target SDK exigido por Play en la fecha de envío (Expo lo actualiza por SDK)                                                                                                                    |

### 8.3 Fichas

Capturas en iPhone 6,9" y teléfono Android (sin tablet en v1, D9; en iOS se declara sólo iPhone con `supportsTablet: false`); textos en español; categoría Negocios/Productividad; clasificación por edades; URL de soporte (`CONTACT_EMAIL`, `utils.ts:4`).

### 8.4 Monetización (BG-004 aplazado)

La propuesta documentada es Free (3 plazas) y Pro a 19,99 €/mes + IVA mediante Stripe (`docs/product.md`). Implicaciones:

- **Apple (guía 3.1.1):** desbloquear funciones o cuota de una app con una suscripción digital exige In-App Purchase. Las excepciones no encajan bien: «reader apps» no aplica; 3.1.3(b) multiplataforma permite acceder a lo comprado en la web **siempre que también se ofrezca por IAP**; 3.1.3(c) «Enterprise» sólo cubre ventas a organizaciones para sus empleados, no autónomos o pequeñas empresas que contratan individualmente (zona gris: no basarse en ella sin consultarlo).
- **Excepciones regionales:** en la tienda de EE. UU., tras la sentencia Epic v. Apple (abril de 2025) se permiten enlaces y botones a compra externa sin comisión; en la UE (DMA) existen condiciones alternativas con comisiones reducidas y requisitos propios. El mercado objetivo es España, así que aplica el régimen UE: verificar las condiciones vigentes al decidir.
- **Google Play:** Play Billing obligatorio para bienes digitales; en el EEE existe el programa de facturación alternativa/«user choice billing» con comisión reducida; en EE. UU. las reglas cambiaron tras Epic v. Google (2025). Verificar en el momento.
- **Comisiones:** 15 % en el Small Business Program de Apple y en suscripciones de Google; Apple aplica 15 % a suscripciones a partir del segundo año.
- **Opciones:**
  1. **Elegida (D7) mientras BG-004 esté aplazado:** app gratuita; las cuentas `premium` existentes (asignadas por administración) funcionan en la app; **ningún texto, precio ni enlace a compra** dentro de la app. Cumple las guías porque no se vende nada en la app.
  2. Al reactivar BG-004: IAP (App Store y Play) + Stripe en web, con **RevenueCat** (o webhooks propios) sincronizando un único `plan` en Firestore mediante Functions. Precio en tienda ajustado por comisión (p. ej., 19,99 € web / 24,99 € en tienda, decisión comercial).
  3. Sólo Stripe con enlace externo bajo las condiciones UE/EE. UU.: posible pero con requisitos y comisiones propias; requiere revisión legal.

---

## 9. Roadmap

Estimaciones para 1 desarrollador a tiempo completo, con margen del 15–20 % incluido. Rangos porque dependen de los spikes de fase 0. Revisadas el 14-11-2026: el borrado de cuenta, el payload push por plataforma, App Check web y los textos legales ya están en `main`, e i18next ya no existe.

### Fase 0 — Preparación y monorepo (3–4 semanas)

**Entregables**

- Spec [BG-014](../specs/BG-014-app-nativa.md) aprobada (decisiones D1–D10 ya resueltas, salvo D6 aplazada).
- `pnpm-workspace.yaml`; `@bg/domain` extraído con sus tests, incluido el modelo BC3 de `construction-document`; Functions importa de `@bg/domain` en lugar de `../../src` (`quoteEstimator.ts`, `privacyNotice.ts`, `notifications/preferences.ts`).
- Helpers de progreso y fecha que quedan en componentes o duplicados, extraídos (§2.3 A).
- `@bg/ui-tokens` con generación del `@theme`.
- `apps/mobile` vacía con Expo Router, dev client, EAS configurado, tres variantes.
- **Spikes:** (a) repositorio `project` con RNFB contra emulador; (b) `buildBudgetDocument` en Hermes + compartir; (c) push FCM en iOS y Android con dispositivo físico contra `budgenerator` y una cuenta sintética (D5); (d) persistencia y `clearPersistence` al cambiar de cuenta.

**Criterios de aceptación:** la web pasa `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:rules`, `pnpm build:functions`, `pnpm test:e2e` sin cambios funcionales; dev client arranca en simulador iOS y emulador Android contra emuladores Firebase; informe de spikes con decisión go/fallback.

### Fase 1 — Núcleo (6–8 semanas)

**Entregables:** `@bg/firebase-api` y `@bg/app-core` (stores, `WriteQueue`, red, sesión, caché MMKV); login/registro con aceptación de condiciones, verificación de email y recuperación; tabs con apertura en la última usada (D8); Presupuestos (lista, detalle, editor, alta guiada, aceptar, PDF y compartir, enlace público); Proyectos (lista, detalle, marcar partidas, fechas, suplementos); Solicitudes (lista, detalle, borrar, crear presupuesto); Mi cuenta con cerrar sesión; offline de lectura (contrato BG-012).

**Criterios de aceptación:** mismos importes que la web para un conjunto de presupuestos de prueba (test de paridad sobre `budgetTotals`); el PDF móvil y el web son equivalentes página a página para el documento largo de tests; en modo avión las vistas visitadas se muestran sin skeleton y una mutación muestra el toast; cambiar de cuenta no deja datos del UID anterior (test automatizado); Maestro cubre login → presupuesto → PDF.

### Fase 2 — Paridad (4–5 semanas)

**Entregables:** Equipo (planificación semanal con swipe, asignaciones diarias, trabajos puntuales, gestión de personas y cuadrillas); push nativo de solicitudes (registro con `platform` desde la app; el payload ya existe, §5.3); deep links/universal links; perfil de empresa con logo desde galería; catálogo (búsqueda, edición, importar bibliotecas); plantillas; resumen del estimador; ayuda; **eliminación de cuenta** en la app sobre la callable existente; Sentry; App Check nativo con las Functions en `monitor`.

**Criterios de aceptación:** push recibido con la app cerrada en iOS y Android y el toque abre el lead; conflictos de doble asignación iguales a la web (tests de `dailyAssignments` compartidos); borrar la cuenta desde la app deja vacías todas las colecciones del UID en el emulador; accesibilidad revisada con VoiceOver/TalkBack en los flujos principales.

### Fase 3 — Nativo diferencial (3–4 semanas; cada punto requiere spec propia)

**Entregables (D10):** marcar partidas sin red con indicador de pendiente y precarga de proyectos activos (D4); fotos de obra con Cloud Storage, `storage.rules`, subida diferida y borrado en `deleteAccount`; abrir la dirección de la obra en Mapas. Fuera de esta tanda: firma del cliente, acciones rápidas e intents de compartir.

**Criterios de aceptación:** definidos en cada spec; ninguna rompe los criterios de BG-012 en web.

### Fase 4 — Publicación (1,5–2,5 semanas, más tiempos de revisión)

**Entregables:** decisión D6 y cuentas de desarrollador; revisión legal de los textos de `/legal/:document` con los datos de la app; etiquetas de privacidad y Data Safety; fichas y capturas de teléfono; cuenta de revisión sintética; App Check en `enforce`; beta en TestFlight y prueba cerrada de Play (14 días si la cuenta es personal); envío a revisión; EAS Update de producción configurado.

**Criterios de aceptación:** aprobada en ambas tiendas; crash-free ≥ 99,5 % en beta; ninguna prueba sobre datos reales; checklist de publicación registrado en `docs/plan.md`.

**Total:** 18–23 semanas. Camino crítico: spikes de fase 0 → `@bg/firebase-api` → push nativo.

### 9.1 Riesgos y mitigaciones

| Riesgo                                                                     | Impacto                                | Mitigación                                                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Diferencias RNFB vs JS SDK rompen la reutilización de `entities/*/api`     | Duplicar ~1.600 líneas de repositorios | Spike en fase 0; suite de contrato común contra emuladores; fallback de repositorios por plataforma                  |
| jsPDF falla o es lento en Hermes                                           | PDF divergente                         | Spike; fallback `expo-print` con HTML basado en los mismos totales                                                   |
| Persistencia offline de Firestore filtra datos entre cuentas               | Privacidad                             | `terminate` + `clearPersistence` + borrado MMKV en `resetSession`; test automático de cambio de cuenta               |
| Divergencia de reglas de negocio entre web y móvil                         | Importes distintos                     | Dominio único, tests de paridad, Functions sobre el mismo paquete                                                    |
| Rechazo en revisión de Apple (borrado de cuenta, 4.2, metadatos de compra) | Retraso de semanas                     | Borrado de cuenta en fase 2; ninguna mención a precios; cuenta demo preparada                                        |
| Payload data-only no visible en iOS                                        | Avisos perdidos                        | Payload por plataforma ya en `main` (§5.3); pruebas en dispositivo físico                                            |
| Sin staging, las pruebas en dispositivo tocan producción (D5)              | Datos de prueba en `budgenerator`      | Sólo cuentas sintéticas, borradas al terminar con `deleteAccount`; nunca deploys de reglas o Functions para probar   |
| Migración del monorepo rompe el despliegue de la PWA                       | Producción afectada                    | Monorepo incremental; web en la raíz hasta la beta; verificación byte a byte de Hosting como en despliegues previos  |
| Expo SDK cambia durante el desarrollo                                      | Retrabajo                              | Fijar SDK al inicio; actualizar sólo entre fases                                                                     |
| Un solo desarrollador y dos plataformas                                    | Plazo                                  | Ambas a la vez con el mismo código y sólo teléfono (D9); si el plazo aprieta, beta interna primero en una plataforma |
| Coste de App Check/Functions al forzar en callables públicas               | Bloqueo de la landing                  | `monitor` primero (ya activo); no forzar en públicas hasta verificar la landing                                      |

### 9.2 Fuera de alcance de esta spec

Integración con Web Factory Lite, importación y exportación de ficheros BC3 en la app, IA (BG-006), landing por empresa, CRM, cuentas para trabajadores, tablet (D9), firma del cliente (D10), compras in-app (D7), proyecto de staging (D5), modo oscuro, analítica de producto.

### 9.3 Verificaciones requeridas antes de cerrar cada fase

`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:rules` (si hay reglas), `pnpm test:integration` (si hay Functions), tests de `packages/*`, Jest móvil y Maestro en `preview`. Registrar resultados reales en `docs/plan.md` y en la spec, sin inventarlos (AGENTS.md).

### 9.4 Decisiones

Revisadas con el propietario el 14-11-2026.

| ID  | Decisión                                                                                  | Resolución                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | ¿Aprobar monorepo pnpm incremental (web en raíz hasta la beta)?                           | **Aprobado.** Monorepo pnpm incremental; la web sigue en la raíz hasta la beta móvil.                                                                                                                                                |
| D2  | ¿RNFB en móvil y JS SDK en web, con repositorios inyectables?                             | **Aprobado, condicionado al spike** de fase 0; fallback de repositorios por plataforma con suite de contrato común.                                                                                                                  |
| D3  | ¿Activar persistencia de Firestore en móvil (desviación de BG-012 sólo para nativo)?      | **Aprobado** sólo en nativo, con `terminate` + `clearPersistence` + borrado de MMKV al cerrar sesión o cambiar de cuenta y test automático.                                                                                          |
| D4  | ¿Permitir escrituras offline en fase 3 y en qué flujos?                                   | **Sólo marcar partidas**, con spec propia. El resto de mutaciones offline siguen bloqueadas.                                                                                                                                         |
| D5  | ¿Crear un proyecto Firebase de staging real?                                              | **No se crea.** Las variantes `development` y `preview` usan emuladores `demo-*`; las pruebas en dispositivo físico (push, TestFlight, prueba cerrada de Play) van contra `budgenerator` con cuentas sintéticas, nunca datos reales. |
| D6  | Bundle ID, nombre en tienda y titular de las cuentas (persona u organización con D-U-N-S) | **Aplazado hasta antes de la fase 4.** No bloquea fases 0–3; se trabaja con `com.budgenerator.app` como identificador provisional.                                                                                                   |
| D7  | Política de monetización en la app mientras BG-004 esté aplazado                          | **App gratuita** sin precios, compras ni enlaces de pago; las cuentas `premium` asignadas por administración funcionan igual.                                                                                                        |
| D8  | Tab inicial de la app (Proyectos como la web o Presupuestos)                              | **Última tab usada;** la primera vez, Presupuestos.                                                                                                                                                                                  |
| D9  | ¿Plataforma prioritaria y soporte de tablet?                                              | **iOS y Android a la vez, sólo teléfono** en v1.                                                                                                                                                                                     |
| D10 | Priorización de fase 3 (offline escritura, fotos, firma, mapas)                           | **Marcar partidas sin red, fotos de obra y abrir la obra en Mapas.** La firma del cliente queda fuera de la primera tanda.                                                                                                           |

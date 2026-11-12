# Firebase

Servicios utilizados: Authentication con email/contraseña, Firestore, Hosting, Cloud Functions (estimador público, avisos, cuenta y retención), Cloud Messaging y App Check. No hay Storage, servidor propio o pasarela de pagos en este checkout.

## Configuración

`shared/firebase/config.ts` utiliza las variables `VITE_FIREBASE_*` de `.env.example`. Con `VITE_USE_FIREBASE_EMULATORS=true` exige un projectId `demo-` y conecta a Auth local 9199, Firestore local 8180 y Functions local 5001 (puertos sobrescribibles con `VITE_FIREBASE_*_EMULATOR_*`). La región de Functions es `europe-southwest1`, la misma que Firestore; se fija en `functions/src/core/config.ts` (`FUNCTION_REGION`) y en el cliente con `VITE_FIREBASE_FUNCTIONS_REGION` (por defecto la misma). Functions usa Node.js 24, sin instancias mínimas, 256 MiB, 15 s en las callables públicas, 30 s en las autenticadas, 300 s/512 MiB en las de cuenta y 540 s en las programadas. La configuración no secreta de Functions vive en `functions/.env` (versionado); un proyecto concreto puede sobrescribirla con `functions/.env.<projectId>`, ignorado por Git. El build de pruebas fuerza valores demo; los scripts de deploy rechazan esos valores.

## Documentos

```text
users/{uid}                            Cuenta, plan y contador acumulado
├── budgets/{id}                       Raíz ligera: revisión, número, negocio y flujo (FIEBDC en content)
│   └── content/{0..7}                 Contenido FIEBDC (JSON) de una revisión, troceado a ≤ 900 KB
├── teamMembers/{id}                   Persona del equipo
├── crews/{id}                          Cuadrilla con etiqueta, color y miembros
├── projects/{id}                      Snapshot del proyecto y resumen de avance
│   ├── progress/state                 Fecha de finalización por ocurrencia (nodo) o ampliación
│   ├── assignments/{id}               Snapshot de persona o cuadrilla asignada
│   ├── supplements/{id}                Registro inmutable de una ampliación
│   └── supplementVoids/{id}            Anulación inmutable con motivo
├── catalog/main                       Catálogo único (raíz ligera) + content/{0..7}
├── templates/{id}                     Plantilla (raíz ligera) + content/{0..7}
├── profile/data                      Datos de empresa y logo PNG como data URL
├── quoteEstimator/settings           Configuración privada del estimador público
├── leads/{leadId}                     Solicitudes privadas; titular puede listar/leer/borrar
├── settings/notifications              Preferencia push y fecha de activación; elimina campos email legacy al guardar
└── pushDevices/{installationId}        Token FCM o FID legacy, hash, plataforma (web/ios/android), habilitación, recuperación y actividad; Admin SDK
sharedBudgets/{token}                  Snapshot público v3: negocio permitido + contenido FIEBDC sin datos privados, `expiresAt`
publicQuoteTokens/{token}              Índice token → UID, sólo servidor
quoteEstimatorLinks/{uid}              Token activo del propietario, sólo servidor
quoteEstimateRateLimits/{token}        Ventana de frecuencia, sólo servidor
quoteLeadRateLimits/{token}            Límite de envíos de leads, sólo servidor
leadNotificationJobs/{jobId}            Cola técnica de entrega, sólo servidor
pushInstallationIndex/{credentialHash} Asociación única token FCM/FID → usuario/dispositivo, sólo servidor
notificationDeviceCounts/{uid}         Límite de dispositivos, sólo servidor
abuseRateLimits/{scope_hash_window}    Contadores anti-abuso por red, titular y global con TTL `expiresAt`, sólo servidor
```

`users/{uid}` admite además `legalAcceptance: { version, acceptedAt }` en el alta; las reglas exigen `acceptedAt == request.time`.

Los IDs son UUID y las fechas de auditoría son ISO strings. La fecha de finalización elegida por el usuario se guarda como día local `YYYY-MM-DD` para evitar cambios de día por zona horaria. El vencimiento premium añade milisegundos para las reglas; el vencimiento público es numérico.

## Modelo canónico FIEBDC (BC3)

Presupuestos, plantillas y catálogo se persisten como `ConstructionDocument` (`entities/construction-document`): conceptos por código FIEBDC con unidad literal, precios por rótulo, textos y descomposición; árbol de ocurrencias (capítulos y partidas) con rendimiento y mediciones `~M`; `~K` (decimales y porcentajes) y registros no interpretados como extensiones opacas. No existe otro modelo persistido de presupuesto, catálogo o plantilla: `WorkItem`, `BudgetTask` y `CatalogPart` son vistas derivadas en memoria.

Persistencia: raíz ligera con `id`, `kind`, `schemaVersion: 1`, `revision`, `contentRevision`, `chunkCount`, fechas y los campos de negocio sin equivalente FIEBDC (`name`, `clientName`, `address`, `date`, `budgetNumber`, `ivaRate`, `adjustment`); los presupuestos añaden `number`, `acceptedAt`, `projectId` y `sourceLeadId`. El contenido FIEBDC se serializa a JSON y se trocea por bytes UTF-8 en `content/{0..7}` (`{ index, revision, data }`, ≤ 900 KB cada uno, ~7,2 MB en total). Se eligió un JSON troceado en lugar de un documento por concepto porque cada guardado es una única transacción (límite de 10 MiB) y las lecturas son 1 + n documentos, frente a miles de lecturas y escrituras por catálogo; los mapas anidados de Firestore además limitan la profundidad a 20 niveles, que un árbol de capítulos puede superar. `firestore.indexes.json` excluye `data` de la indexación.

Concurrencia optimista: cada escritura de la raíz incrementa `revision` en uno (Rules) y el cliente guarda en transacción sólo si la revisión leída coincide con la última confirmada; si no, la app avisa («se ha guardado desde otro dispositivo») y ofrece cargar la versión guardada o sobrescribirla. Los trozos llevan `contentRevision`; las Rules exigen que se escriban en la misma petición que sube la revisión de la raíz, que el trozo 0 de una revisión de contenido nueva exista y que los sobrantes sólo se borren al encoger. Los lectores comprueban que todos los trozos tengan la `contentRevision` de la raíz y reintentan si no.

Numeración: el número de presupuesto lo asigna la transacción de creación con el contador `totalBudgetsCreated` de la cuenta (`number == totalBudgetsCreated` tras el incremento, validado por Rules); el texto visible `budgetNumber` lo toma si el usuario no escribió otro. Ya no hay `max+1` local.

## Autorización y cuota

Las reglas separan la raíz de cuenta de las colecciones editables; no usan un permiso recursivo que pueda reabrir la raíz. Los clientes nuevos solo pueden crear una cuenta free, no-admin y con contador cero. No pueden asignarse un rol, plan o vencimiento. El administrador se identifica sólo por el custom claim `admin: true` (ver «Administración» más abajo); el email y `accountData.isAdmin` no conceden permisos. El admin lee y lista la raíz `users/{uid}` y cambia `accountData` (plan y vencimiento); no lee presupuestos, proyectos, perfil, catálogo, plantillas ni solicitudes de otras cuentas. Puede borrar un `sharedBudgets` ajeno para retirar contenido abusivo.

La creación de un presupuesto se ejecuta junto al incremento de `totalBudgetsCreated` y `lastCreatedBudgetId` en una transacción. Las reglas limitan Free a tres plazas de creación; borrar un presupuesto no devuelve cuota. Aceptar y convertirlo en proyecto conserva la plaza consumida por el presupuesto origen: la conversión enlaza presupuesto y proyecto de forma atómica, no reduce ni vuelve a incrementar el contador. Los antiguos campos `budgetSlotsReleased` y `lastConvertedBudgetId` pueden seguir presentes en datos previos, pero ya no intervienen en el límite. Actualizar un documento existente no consume otra creación.

BG-009: el presupuesto puede guardar `acceptedAt` y `projectId`. El proyecto conserva el origen (`sourceBudgetId`/`sourceBudgetNumber`), cliente/obra, importes originales (`subtotal`, `iva`, `total`), resumen de ampliaciones (`supplementsSubtotal`, `supplementsIva`, `updatedTotal`) y resumen de progreso (`totalConcepts`, `completedConcepts`, `totalAmount`, `completedAmount`, `percent`, `status`, `completedAt`). En la interfaz, cada documento `workItem` es un capítulo y sus tareas son partidas; se mantienen los nombres de campos actuales para compatibilidad. Cada documento conserva las partidas copiadas y el estado del capítulo. Las fechas seleccionadas se normalizan a día local y no pueden ser futuras. La aceptación sólo cambia `acceptedAt` (y la revisión); un presupuesto aceptado o convertido no admite escrituras de `content`. La conversión atómica crea el proyecto y `progress/state` y guarda `projectId` en el presupuesto, sin alterar la cuota. El proyecto no copia partidas: su estructura se deriva del documento FIEBDC del presupuesto bloqueado y el avance se guarda por ID de ocurrencia.

El propietario puede cambiar el nombre y el cliente de un proyecto ya convertido mediante una transacción de dos documentos. Las reglas sólo permiten `title`, `address` y `clientName` en el proyecto y los campos coincidentes `address`/`clientName` de la raíz de su presupuesto aceptado (con subida de revisión); cada escritura valida el estado final del otro documento con `getAfter`. El nombre no puede quedar vacío, el cliente sí; capítulos e importes permanecen inmutables.

Los suplementos viven en `supplements/{id}` (unidad libre de hasta 20 caracteres) y se muestran como capítulo derivado. El cliente crea el registro una vez; no lo edita ni lo borra. Anularlo crea un documento `supplementVoids/{id}` con motivo en la misma transacción que actualiza el resumen; el historial queda preservado y las cifras/progreso activos se recalculan. La anulación no es una eliminación. Reglas de propietario/admin limitan el acceso a proyecto y subcolecciones; no se publican ni se borran proyectos desde el cliente. Completar partidas o editar fechas escribe `progress/state` y el resumen en una transacción. La conversión admite como máximo 200 capítulos.

Los snapshots públicos (v3) permiten get individual, deniegan list y exigen propietario autenticado con email verificado al crear. Guardan el contenido FIEBDC público: sin costes, descomposiciones, enlaces de catálogo ni extensiones, con el precio unitario ya ajustado. Caducan, son inmutables y su propietario puede revocarlos. El DTO elimina costes internos y metadatos privados antes de escribirlo. Los enlaces legacy no seguros quedan bloqueados; revisar la transición en archive/stability-and-release.md.

El propietario lee y escribe `users/{uid}/quoteEstimator/settings`; la colección raíz `quoteEstimator` queda fuera de las reglas genéricas. El esquema 2 guarda tarifas manuales por estancia en céntimos por m²; el esquema 1 conserva combinaciones vinculadas al catálogo y sigue siendo compatible. Las selecciones nuevas llevan un `instanceId` UUID único para identificar cada estancia física, con su superficie y calidad. `quantity` (entero de 1 a 20) se mantiene para datos agrupados históricos; si falta, se interpreta como una estancia. El perfil conserva una URL HTTPS de privacidad. Las reglas permiten al titular leer/listar y borrar `users/{uid}/leads`, deniegan su creación desde cliente y restringen su única edición a `budgetId` hacia un presupuesto de la misma cuenta. La creación del lead solo ocurre en `submitPublicLead`, con Admin SDK. Las reglas deniegan clientes para el índice `publicQuoteTokens`, el enlace por UID y los contadores. `publishPublicEstimator`, `revokePublicEstimator` y `getOwnerEstimatorStatus` requieren Auth. `getPublicEstimator`, `calculatePublicEstimate` y `submitPublicLead` son públicos y reciben el token aleatorio de 24 bytes codificado base64url; el token localiza al usuario en Functions, nunca habilita una lectura Firestore del visitante. `getPublicEstimator` devuelve nombre de empresa, contactos optativos y combinaciones disponibles; el cálculo y el envío solo devuelven horquilla total, moneda, IVA y confirmación. No se devuelven UID, contacto del lead, catálogo, descripciones internas, precios unitarios ni `cost`.

El límite por token válido de estimación es de 20 llamadas por minuto, compartido por resolución del formulario y cálculo. El envío de leads tiene un límite separado de 10 por token en una hora. Además, antes de cada handler público se aplican límites por red (IP, IPv6 agrupada por /64), por titular y globales; se describen en «Abuso» más abajo. Ni la IP ni el UID se guardan en claro: los contadores usan un hash. El lead conserva contacto, selecciones, plazo de inicio elegido, horquilla, fechas de consentimiento y URL de privacidad hasta que el titular lo borre o se cumpla la retención (12 meses por defecto). El plazo es una de cuatro opciones generales y no implica duración ni compromiso de fecha. El nombre de empresa se muestra; teléfono y correo solo se incluyen si el propietario lo habilita. La horquilla puede permitir inferir parcialmente precios subyacentes al comparar muchas combinaciones, aunque el endpoint no los exponga directamente.

### BG-011 — equipo y asignaciones

El roster vive en `users/{uid}/teamMembers/{memberId}` y `users/{uid}/crews/{crewId}`. `/projects/{projectId}/assignments/{assignmentId}` guarda snapshots con IDs deterministas `member_{resourceId}` / `crew_{resourceId}`; la API sólo asigna recursos activos, comprueba referencias y limita cada snapshot a menos de 900.000 bytes UTF-8. Una mutación crea/elimina la asignación y avanza `projects/{projectId}/assignmentState/current.revision` en la misma transacción; la revisión serializa operaciones de pestañas concurrentes y las Rules exigen el avance asociado. La API impide que una persona aparezca más de una vez entre asignaciones individuales y cuadrillas. Las Rules validan el proyecto propietario, el formato básico del snapshot y que la fuente coincida con una persona/cuadrilla activa de la cuenta. Las asignaciones se pueden retirar sin borrar el recurso original.

Las reglas limitan personas y cuadrillas a la cuenta propietaria, y validan que cada asignación snapshot coincida con un recurso activo de esa cuenta. El progreso y las fechas editables de proyecto siguen las reglas BG-009. La antigua colección `projectAgenda` no tiene reglas de lectura/escritura y no se usa desde el cliente; no se borran documentos antiguos ni se ejecuta migración. Ver el plan vigente de BG-011.
La planificación semanal lee los snapshots globales y los overrides en `users/{uid}/projects/{projectId}/dailyAssignments/{YYYY-MM-DD}`. Cada override guarda `date`, `projectId`, `assignments` y `updatedAt`; una lista vacía expresa que ese día no va nadie. El cliente lee sólo las siete fechas solicitadas, limita cada lista a 500 recursos y el documento a 900 KB, y valida cada snapshot antes de escribir. Las reglas limitan por propietario, proyecto, fecha, cantidad de elementos, tamaño y estado `pending` o `in_progress`; no iteran los mapas anidados de la lista. Los planes ya guardados siguen legibles al completar el proyecto, pero no se pueden editar; borrarlos restaura la composición global. `projects/{projectId}.estimatedEndDate` es un campo opcional `YYYY-MM-DD`: las reglas aceptan cambios sólo a ese campo y con formato de fecha, mientras la API valida que el día local exista. El planificador lo aplica como límite inclusivo sin eliminar overrides posteriores. Los proyectos históricos sin el campo siguen disponibles y no requieren migración.

Los trabajos puntuales se guardan fuera de los proyectos en `users/{uid}/teamJobs/{jobId}`; cada miembro/cuadrilla snapshot ocupa `assignments/{assignmentId}` bajo ese trabajo y se crea en la misma transacción. Las reglas permiten leer y crear sólo al propietario, validan metadatos, fecha local, enlace opcional a un proyecto del mismo UID y cada recurso activo por snapshot; el título es obligatorio y la descripción admite una cadena vacía, con un máximo de 2.000 caracteres. No permiten actualizar o borrar estos registros. Un proyecto completado puede enlazarse sin límite temporal; guardar el trabajo no muta el proyecto. Estas reglas se desplegaron junto con Hosting a `budgenerator` el 07-11-2026 y pasaron 73/73 pruebas del emulador.

Fecha estimada BG-011 (07-11-2026): Firestore Rules y Hosting se desplegaron a `budgenerator`; PWA `beb6f2e46178174d`. Los 98 recursos de Hosting coinciden con `dist`, y `/projects`, `/team` y `/projects/project-navigation` responden HTTP 200. Rules Emulator: 61/61. No se desplegaron Functions ni se migraron o modificaron documentos reales. La rama continúa sin integrar en `main`.

### BG-012 — modo offline

No cambia el esquema, las reglas ni las Functions. Se mantienen lecturas puntuales y no se activa la caché persistente global de Firestore. La app guarda snapshots de stores y respuestas consultadas bajo demanda en IndexedDB, con claves privadas por UID, para restaurar las rutas ya consultadas después de recargar offline. El cierre de sesión o cambio de cuenta elimina las entradas privadas del UID anterior. Los adaptadores de escritura bloquean cambios cuando el navegador está sin red y notifican fallos reales de Firestore/Functions; no se crea una cola offline nueva. Si el navegador conserva conexión, las lecturas posteriores pueden probar el backend y `PwaStatus` reintenta la carga de sesión cada 30 segundos; un éxito restaura el estado y activa el vaciado de `WriteQueue`. Para esta entrega se despliega únicamente Hosting.

## Migraciones

El modelo FIEBDC (12-11-2026) sustituye sin migración a `tariffCatalogs`, `tariffs`, `settings/tariffCatalog`, las partidas embebidas de `budgets`/`templates` y `projects/*/workItems`: no hay usuarios y esas rutas quedan cerradas por Rules. El perfil antiguo en settings/profile se traslada a profile/data. Las cuentas legacy no se promocionan a roles de confianza desde un documento editable: requieren revisión administrativa. Las operaciones de migración no se deben interpretar como una migración global transaccional del proyecto.

## Pruebas y publicación

`pnpm test:integration` construye Functions y ejecuta reglas y navegador sobre emuladores de Auth, Firestore y Functions. El despliegue se hace siempre con `scripts/deploy.mjs` (ver «Operación y despliegue»). El build remoto usa pnpm y requiere `functions/pnpm-workspace.yaml` con aprobación explícita de los scripts de `@firebase/util` y `protobufjs`, además de `@google-cloud/functions-framework` como dependencia directa.

BG-005 se desplegó el 18-10-2026 al proyecto `budgenerator`: Hosting en https://budgenerator.web.app; seis Cloud Functions v2 ACTIVE en `europe-west1` con runtime Node.js 22; y las reglas de Firestore. Se configuró limpieza automática de imágenes de Functions tras 1 día. Firestore Standard está en `europe-southwest1`; no se escribieron ni migraron datos durante el despliegue. La región de Functions es independiente de la base Firestore. CI no despliega. La cuenta admin de la aplicación no autentica al CLI.

La simplificación del configurador BG-005 se publicó el 18-10-2026 con `--only functions,hosting`: las seis Functions siguen ACTIVE y Hosting responde HTTP 200. Las reglas y los documentos existentes no se modificaron en esta actualización.

El refinamiento por instancia física, gestión del enlace y navegación de BG-005 se desplegó el 18-10-2026 con `--only functions,hosting`. Hosting responde HTTP 200 y publica PWA `c5e5f82bd46dd887`; las seis Functions están ACTIVE en `europe-west1` con Node.js 22. No se desplegaron reglas ni se modificaron documentos de Firestore.

El ajuste de navegación del 18-10-2026 se desplegó solo a Hosting: Estimador se movió del menú principal al menú del header y se ordenaron sus opciones. Hosting responde HTTP 200 y publica PWA `47e844d6b2b97b27`. No hubo cambios de Functions, reglas ni documentos de Firestore.

El 18-10-2026 se corrigió el 403 de los callables del estimador estableciendo `roles/run.invoker` para `allUsers` en los seis servicios Cloud Run. La publicación de Functions por sí sola no actualizó esta política IAM en los callables existentes. Esto habilita llegar a la capa callable; `publishPublicEstimator`, `revokePublicEstimator` y `getOwnerEstimatorStatus` exigen autenticación Firebase en su handler, y los callables públicos validan token aleatorio y límites por token antes de leer o guardar datos. La comprobación sin sesión pasa de 403 en Cloud Run a 401 `UNAUTHENTICATED` generado por el handler. No se modificaron reglas ni documentos de Firestore.

BG-008: inicialización idempotente en transacción sobre `tariffCatalogs/main-v1` y `settings/tariffCatalog`. Datos actuales de prueba: se copia el catálogo activo antes de borrar sobrantes; las tarifas legacy tienen prioridad sobre la base inicial si no existe catálogo. Un fallo de creación no borra fuentes; un fallo de limpieza admite reintento y conserva el destino. No cambian las reglas ni los permisos. La unicidad es un contrato de la aplicación; clientes antiguos aún pueden escribir otros IDs bajo las reglas actuales. No se ejecuta un borrado global ni una migración remota mediante scripts.

## BG-010 — avisos de nuevas solicitudes

`submitPublicLead` conserva su respuesta y transacción actuales. El trigger `onDocumentCreated` de `users/{uid}/leads/{leadId}` crea trabajos SHA-256 idempotentes por lead/dispositivo push. La cola guarda UID/leadId y estado técnico, nunca el email del titular, el contacto del visitante ni credenciales FCM. El worker usa leases, máximo cinco intentos, backoff con jitter, horizonte de seis horas. Cada trabajo tiene `retentionExpiresAt` a 30 días; Firestore los elimina mediante TTL asíncrono y la limpieza diaria acotada sirve de respaldo para documentos legacy sin fecha TTL. Antes de enviar vuelve a comprobar lead, usuario, preferencia y dispositivo. Una credencial FCM inválida se borra junto con su índice y el dispositivo queda marcado `recoveryRequired`. La recuperación elimina el token local con `deleteToken()` y solicita uno nuevo con `getToken()`. La revocación explícita elimina el dispositivo y no activa esta recuperación.

Las preferencias se guardan en `users/{uid}/settings/notifications` y contienen sólo `pushEnabled`/`pushEnabledAt`. Las callables derivan el UID de Firebase Auth; `getNotificationSettings` devuelve preferencias push y metadatos de dispositivo sin token, FID ni datos de email. El Admin SDK guarda el token FCM de registro en `pushDevices/{installationId}` y su SHA-256 en `pushInstallationIndex`; conserva lectura y envío por FID sólo para registros legacy. Los clientes no pueden acceder a dispositivos, índices, contadores ni cola según las reglas actuales. Al inicio de sesión se presenta una invitación; el permiso se solicita únicamente al pulsar el botón, y el interruptor de Mi cuenta activa permiso, registro FCM y preferencia en una acción. Al volver de Ajustes se actualiza el permiso. Al cerrar sesión se revoca primero el dispositivo remoto y se elimina el registro FCM; si la red falla, queda una revocación pendiente sólo local para ese UID. La recuperación automática de credenciales inválidas requiere `recoveryRequired` y permiso ya concedido. Si se solicita una nueva activación con la preferencia de cuenta activa pero sin dispositivo habilitado, se borra el token anterior antes de pedir uno nuevo.

El sitio usa Firebase Web Messaging 12.14.0 (`getToken()` para obtener el token FCM de registro) y Functions Admin 14.1.0 (envío por token; los FID sólo se mantienen para registros legacy). `vite.notifications-sw.config.ts` empaqueta `src/features/notifications/messaging-sw.ts` como `dist/fcm-sw.js`; `public/sw.js` lo importa con una versión ligada al precache existente. El payload es data-only con jobId/leadId y el worker muestra copy fijo con tag estable y click a `/profile/solicitudes`. No se cachean leads ni payloads privados.

No existe transporte de correo en BG-010. Los trabajos email históricos se marcan `skipped/channel_removed` al reclamarlos, antes de aplicar límites de reintento o leer lead/usuario; no se crean nuevos trabajos de ese canal. El contrato antiguo se acepta sólo con `emailEnabled:false` durante la transición y al guardar se eliminan los campos heredados de preferencias. La VAPID web es pública y se pasa al build mediante `VITE_FIREBASE_VAPID_KEY`; para la prueba de Hosting se usó la clave proporcionada por el titular desde `.env.local`, ignorado por Git. Sin esa variable el cliente bloquea la activación push. El despliegue inicial del 18-10-2026 publicó Functions e índices y Hosting PWA `13a9d4d6113bf954`; `/`, `sw.js`, `fcm-sw.js`, `manifest.json` y el bundle de notificaciones respondían HTTP 200. El bundle incluía la VAPID de build. No se escribieron leads ni se enviaron mensajes.

Reparación push-only desplegada el 18-10-2026: las 13 Functions se actualizaron en `budgenerator` y Hosting publicó PWA `c12bd1674c213281`. Los 94 archivos locales coinciden byte a byte con Hosting y el bundle contiene la VAPID configurada. El 401 previo ocurría en Cloud Run antes del callable, por lo que se añadió `roles/run.invoker` para `allUsers` sólo a `getNotificationSettings`, `setNotificationPreferences`, `registerPushDevice` y `revokePushDevice`; cada handler conserva `requireNotificationOwnerUid`. Requests sin sesión a las cuatro callables responden HTTP 401 `UNAUTHENTICATED` desde Firebase Functions. No se publicaron reglas ni se cambiaron documentos. La recepción física y la asociación de VAPID/FCM siguen pendientes; no se escribieron leads ni se enviaron mensajes.

Incidente de acceso del 18-10-2026: el módulo Firebase servido por Hosting llevaba `authDomain=demo-bg010-e2e.firebaseapp.com`, aunque el `.env.local` del worktree indicaba `budgenerator`. Esto enviaba el inicio de sesión al proyecto demo de pruebas, no al proyecto de producción. Se reconstruyó con configuración de producción y se volvió a publicar sólo Hosting. Después se verificó que el `index.html` y `sw.js` remotos coincidieran con `dist`, y que el módulo Firebase remoto incluyera `budgenerator.firebaseapp.com` y no el dominio demo. Antes de publicar Hosting, comprobar que el bundle compilado apunta a `projectId=budgenerator` y `authDomain=budgenerator.firebaseapp.com`.

Incidente de recepción push (18-10-2026): los logs de producción muestran trabajos creados al enviar formularios, pero FCM rechazó los FID como no registrados; el worker borró los dispositivos y la preferencia global quedó activa sin dispositivo actual. La reparación conserva una marca `recoveryRequired` sin FID ni hash y re-registra sólo ese dispositivo si la preferencia sigue activa y el permiso sigue concedido. La revocación manual mantiene su semántica y no se deshace al volver a abrir la app. Verificados los emuladores Auth/Firestore y tests de recuperación; la entrega física requiere una nueva prueba desde una PWA instalada.

Seguimiento del incidente push (18-10-2026): FCM siguió rechazando como no registrados los FID reactivados. El SDK Web conserva en IndexedDB el registro FCM hasta siete días y `register()` puede reutilizarlo; si `unregister()` falla porque FCM ya lo invalidó, la caché local permanece. El cliente ahora intenta `unregister()` antes de recuperar y, ante fallo, elimina la Firebase Installation para obligar al SDK a generar y registrar un FID nuevo. Durante esta operación `onUnregistered` no revoca la fila del servidor. La reparación se publicó sólo a Hosting en `budgenerator` (PWA `2266d9dab9329a25`); los 96 archivos remotos coinciden byte a byte con el build, que usa Auth de producción. No se desplegaron Functions ni reglas ni se escribieron datos. El E2E de permisos y los tests unitarios pasan; falta validar la recepción física desde la PWA instalada, sin enviar formularios del agente ni escribir datos reales.

Seguimiento de recepción push (18-10-2026): los nueve trabajos más recientes observados en producción seguían terminando en `skipped/device_unregistered`; los dos registros del propietario estaban deshabilitados, marcados `recoveryRequired` y sin FID utilizable. La herramienta Firebase conectada no puede enviar a FID, y no hay un dispositivo activo al que dirigir la prueba manual. La recuperación se endureció para rotar la Firebase Installation tras cualquier intento de `unregister()`, también cuando éste responde correctamente. El cliente se publicó después sólo a Hosting en `budgenerator` (PWA `3583012f243c1379`); los 96 archivos responden HTTP 200, coinciden con `dist` y el módulo Firebase apunta a Auth de producción. Tras publicar, la preferencia sigue activa, pero los dos dispositivos continúan pendientes de recuperación; falta abrir la PWA actualizada para que el cliente registre un FID nuevo y comprobar la entrega física. No se escribió ningún lead, no se modificaron documentos y no se enviaron mensajes.

La extensión de BG-008 persiste `parts[]`, que la interfaz presenta como capítulos, con `concepts[]` anidados que presenta como partidas. El adaptador agrupa catálogos planos antiguos por `Tariff.category` y asigna IDs deterministas; la escritura canónica ocurre durante la carga idempotente del catálogo. Los presupuestos y plantillas mantienen sus snapshots históricos: sólo las nuevas selecciones guardan `catalogPartId` y `catalogConceptId` opcionales. Esos IDs son privados y se omiten de los DTO públicos. Este ajuste es sólo terminológico y no cambia el esquema ni requiere migración.

El 18-10-2026 se desplegó la extensión BG-009 a Hosting y reglas de Firestore en `budgenerator`, después de verificar en emuladores 39 pruebas de reglas y 35 E2E. La base `(default)` se confirmó Standard en `europe-southwest1`. Hosting publica PWA `76226c9116b5a43b`; `index.html` y `sw.js` responden HTTP 200 y sus bytes coinciden con `dist`. No se desplegaron Functions ni se modificaron documentos reales de Firestore. El worktree se actualizó al commit de `main` `0d744fe`, que incluye Leads; los cambios de la extensión no se comprometieron ni fusionaron.

Seguimiento de BG-010 (18-10-2026): después de reactivar el dispositivo, el FID volvió a ser rechazado al procesar el último aviso pendiente. La función registra ahora sólo `providerCode` de FCM para diagnosticar el siguiente intento; no escribe FID, UID ni IDs de trabajo en Cloud Logging. El intento de prueba reusó un trabajo real que ya estaba saltado y no creó un lead. Las 13 Functions se desplegaron para publicar este diagnóstico; Hosting y reglas no se actualizaron en esta operación. La causa exacta queda pendiente de la siguiente activación y envío.

Corrección de credenciales de entrega (18-10-2026): FCM devolvía `messaging/installation-id-not-registered` al recibir un FID. Los dispositivos nuevos se registran ahora con el token FCM de `getToken()` y Admin SDK envía por ese token; la lectura FID queda sólo para filas legacy. Tokens/FID e índices siguen siendo privados y el DTO de ajustes sólo publica estado. El cliente llama `deleteToken()` al recuperar y sincroniza el token al activar o al iniciar sesión. Se desplegaron Functions y Hosting; las comprobaciones de producción aún no encontraron token porque el dispositivo seguía en `recoveryRequired`. La PWA instalada debe abrirse con el bundle actualizado antes de probar el envío.

Validación de entrega (18-10-2026): después de abrir la PWA nueva, el dispositivo quedó habilitado con un token privado. Firebase Messaging aceptó la push de prueba directa. El trabajo asociado a la solicitud real se reencoló una sola vez y el worker lo marcó `sent` al primer intento. FCM aceptó ambos envíos; la visualización física en el iPhone no se puede confirmar desde el estado del servidor.

Integración y publicación final del MVP (18-10-2026): el commit `eead64e2107fa54cd702f3cd1fb27e63ac75bcaa` se integró por fast-forward y se publicó en `origin/main`. Se desplegaron `hosting`, `functions` e `indexes` al proyecto `budgenerator`; Firebase CLI confirmó la publicación de índices y las 13 Functions aparecen `ACTIVE` con runtime Node.js 22. Hosting publicó la PWA `148aa24ecf009375`; `/`, `sw.js` y `fcm-sw.js` responden HTTP 200 y sus bytes coinciden con `dist`. El build usó la configuración de producción y contiene la VAPID pública, sin activar emuladores. `pnpm lint`, `pnpm format:check`, `pnpm build` y `pnpm build:functions` finalizaron correctamente; el último avisó que el entorno local usa Node 24 aunque Functions tiene configurado Node 22. No se desplegaron reglas ni se escribieron documentos o leads. No se ejecutaron suites de tests. El estado de aprovisionamiento TTL no se consultó por separado porque `gcloud` no está instalado; la publicación de los índices sí quedó confirmada por Firebase CLI.

BG-011 publicado para prueba live (06-11-2026) desde `codex/bg011-equipo-agenda` al proyecto `budgenerator`: Hosting y Firestore Rules. Hosting publica la PWA `a312e0cac2ade3df`; el HTML, ambos service workers y los 96 recursos precargados coinciden byte a byte con `dist`, y `/team` y `/projects/project-navigation` responden HTTP 200. Pasaron 54/54 pruebas de reglas en emuladores. No se desplegaron Functions, no se migraron ni escribieron datos reales y el código aún no está integrado en `main`.

Refinamiento visual de BG-011 (06-11-2026): el encabezado de `/team` separa título de subtítulo/acciones y sustituye el texto de los botones de cabecera por iconos con nombres accesibles. Se publicó sólo Hosting en `budgenerator`, desde `codex/bg011-equipo-agenda`, con PWA `57f193ec1822dab9`. El HTML, ambos service workers y los 96 recursos precargados coinciden byte a byte con `dist`; `/team` y `/projects/project-navigation` responden HTTP 200. No se publicaron reglas ni Functions y no se escribieron datos reales.

Cabecera móvil unificada (06-11-2026): la cabecera de marca sticky se mantiene en todas las rutas autenticadas; el menú de cuenta móvil aparece sólo en las tabs raíz, y el avatar se retiró de los encabezados de páginas secundarias. El título queda debajo de la cabecera y se desplaza con el contenido. Publicado sólo a Hosting desde `codex/bg011-equipo-agenda`, PWA `24fa500729b65c54`. El HTML, ambos service workers y los 96 recursos precargados coinciden byte a byte con `dist`; `/team`, `/projects`, `/account/password` y `/projects/project-navigation` responden HTTP 200. No se actualizaron reglas ni Functions y no se escribieron datos reales.

Ajuste posterior de cabecera móvil (06-11-2026): las páginas secundarias ocultan marca y menú; el botón de volver aparece en el header y el contenido deja el título/subtítulo a la izquierda debajo. Publicado sólo a Hosting en `budgenerator` desde `codex/bg011-equipo-agenda`, PWA `069edf4a46539b55`. `index.html`, ambos service workers y los 96 recursos precargados coinciden byte a byte con `dist`; `/team`, `/projects`, `/account/password` y `/projects/project-navigation` responden HTTP 200. No se actualizaron reglas ni Functions ni se escribieron datos reales.

Planificación semanal BG-011 (06-11-2026): desplegadas Firestore Rules y Hosting en `budgenerator` desde `codex/bg011-equipo-agenda`. PWA `b6c15682cbc15a6e`; `index.html`, `sw.js`, `fcm-sw.js` y los 97 recursos precargados (100 archivos en total) coinciden byte a byte con `dist`; `/team`, `/projects` y `/projects/project-navigation` responden HTTP 200. El emulador pasó 58/58 pruebas de reglas. No se desplegaron Functions ni se modificaron documentos reales. La rama no se integró en `main`.

Equipo como tab principal (06-11-2026): Hosting se actualizó en `budgenerator` con PWA `fae198999289df03`, para mostrar Equipo tercero en la navegación principal y Solicitudes cuarto. Los 100 archivos estáticos coinciden byte a byte con `dist`; `/team`, `/projects`, `/projects/project-navigation` y `/profile/solicitudes` responden HTTP 200. No cambiaron reglas, Functions ni documentos reales; el worktree sigue sin integrar en `main`.

Filtro semanal flotante BG-011 (06-11-2026): se publicó sólo Hosting en `budgenerator` desde `codex/bg011-equipo-agenda`, PWA `494dda764656241f`. `index.html`, el bundle CSS, el chunk de Equipo y ambos service workers coinciden byte a byte con `dist`; `/team`, `/team/manage` y `/projects` responden HTTP 200. Pasaron lint, build, Prettier de los archivos modificados y `git diff --check`; no se ejecutaron tests. No se desplegaron Rules ni Functions ni se modificaron datos reales. El worktree sigue sin integrar en `main`.

## Endurecimiento del back (12-11-2026)

Aplica las fases 0 a 2 del [análisis del back](analysis/backend.md) que son código o configuración versionable. No se ha desplegado nada ni se ha tocado el proyecto real. Las tareas de consola están al final de esta sección.

### Operación y despliegue

`scripts/deploy.mjs <objetivos> [--project <alias>]` es la única vía de despliegue. Objetivos: `hosting`, `rules`, `indexes`, `functions` o `all`. Atajos: `pnpm firebase:deploy` (Hosting), `pnpm firebase:deploy:all` (todo en producción) y `pnpm firebase:deploy:staging` (todo en staging). El script se detiene si:

- el árbol de Git tiene cambios sin confirmar;
- en producción (`default`), la rama no es `main`, `main` no coincide con `origin/main`, o el último run de CI de `main` no está en verde o no corresponde al commit (con `gh`; si no está disponible, avisa);
- fallan `lint`, `format:check`, `test`, las reglas en emulador (`test:rules:emulator`) o, si se despliegan Functions, `build:functions` y `test:notifications:emulator`;
- el entorno web apunta a emuladores, le faltan variables o su `VITE_FIREBASE_PROJECT_ID` no es el destino;
- el bundle de `dist` contiene un `projectId` distinto del destino o un `authDomain` demo, o no contiene el `authDomain` configurado (incidente del 18-10-2026).

La suite de navegador (`test:integration`) se ejecuta en CI, no en el script. CI ejecuta ahora también `format:check`, `build:functions` y `test:notifications:emulator`.

**Staging.** `.firebaserc` tiene el alias `staging` con el id de ejemplo `CHANGE-ME-budgenerator-staging`; el script se niega a usarlo hasta que se sustituya por el id real. El build de staging lee `.env.staging` (modo Vite `staging`) y Functions puede tener `functions/.env.<projectId>`. No se ha creado ningún proyecto.

**Región y runtime.** Functions pasa de `europe-west1` a `europe-southwest1` (Madrid), la región de Firestore: Cloud Functions 2.ª gen está disponible allí y elimina el salto entre regiones de cada lectura y del trigger. El runtime pasa a Node.js 24 (GA en Firebase CLI 15, fin de soporte 30-04-2028); `functions/package.json`, la raíz y CI usan Node 24. Migración en producción, en este orden: desplegar `functions` (la CLI crea las funciones nuevas y pregunta si borra las de `europe-west1`: responder **no**), desplegar `hosting` (el cliente llama ya a la región nueva), comprobar el estimador y los avisos, y borrar las antiguas con `pnpm exec firebase functions:delete <nombres> --region europe-west1 --project budgenerator`. Las opciones `invoker: 'public'` aplican `roles/run.invoker` a `allUsers` al crear los servicios nuevos; comprobarlo tras el despliegue. Si Cloud Scheduler no estuviera disponible en la región, basta con cambiar `FUNCTION_REGION` sólo para las tareas programadas.

### Abuso

**App Check.** El cliente inicializa App Check con reCAPTCHA Enterprise (o v3 con `VITE_FIREBASE_APPCHECK_PROVIDER=v3`) sólo si existe `VITE_FIREBASE_APPCHECK_SITE_KEY` y no se usan emuladores. Las callables públicas leen `APP_CHECK_MODE` de `functions/.env`: `monitor` (valor actual) acepta y registra `app_check_missing`; `enforce` activa `enforceAppCheck` y rechaza con `failed-precondition`/`app_check_required`; `off` lo ignora. Pasar a `enforce` cuando el evento `app_check_missing` deje de aparecer en tráfico legítimo. `consumeAppCheckToken` (protección de repetición) queda para cuando se use `limitedUseAppCheckTokens` en el cliente.

**Límites.** Además de los límites por token existentes, `functions/src/abuse/` aplica, antes del handler:

| Ámbito                    | Límite por defecto | Variable                             |
| ------------------------- | ------------------ | ------------------------------------ |
| Estimador por red         | 60/min             | `LIMIT_ESTIMATOR_PER_IP_PER_MINUTE`  |
| Estimador global          | 20.000/día         | `LIMIT_ESTIMATOR_GLOBAL_PER_DAY`     |
| Leads por red             | 10/h               | `LIMIT_LEADS_PER_IP_PER_HOUR`        |
| Leads por titular         | 50/día             | `LIMIT_LEADS_PER_OWNER_PER_DAY`      |
| Leads global              | 500/día            | `LIMIT_LEADS_GLOBAL_PER_DAY`         |
| Push de leads por titular | 5/h                | `LIMIT_LEAD_PUSH_PER_OWNER_PER_HOUR` |

Los contadores son ventanas fijas en `abuseRateLimits`, con el sujeto hasheado y TTL en `expiresAt`. Son aproximados (lectura + `increment` sin transacción) para no bloquear los documentos globales; en una ráfaga concurrente pueden excederse en unas pocas unidades. Una petición inválida también consume cupo. Al superar el límite de push, el lead se guarda igual y aparece en Solicitudes, pero no genera aviso; el trigger también descarta eventos con más de 6 h.

**Verificación de email.** El alta envía el email de verificación. Mi cuenta y el estimador muestran un aviso con «Reenviar email» y «Ya lo he verificado», que recarga el usuario y fuerza un token nuevo. Las reglas exigen `email_verified` para guardar `quoteEstimator/settings` y la callable `publishPublicEstimator` lo exige para publicar. Crear un enlace público (`sharedBudgets`) también lo exige. Presupuestos, catálogo y proyectos no lo exigen. La contraseña mínima pasa a 8 caracteres en la UI; la política de Auth se configura en consola.

### RGPD

- **Borrado de cuenta.** Callable `deleteAccount`, con inicio de sesión de menos de 5 minutos (`auth_time`; la UI pide la contraseña y reautentica). Borra tokens del estimador y sus contadores, `quoteEstimatorLinks`, `sharedBudgets` del titular, `pushInstallationIndex`, `leadNotificationJobs`, `notificationDeviceCounts`, el árbol `users/{uid}` completo con `recursiveDelete` y, por último, el usuario de Auth. Es idempotente: un reintento completa un borrado parcial. Los contadores anti-abuso sólo guardan hashes y caducan solos.
- **Exportación.** Callable `exportAccount`: JSON con todos los documentos del árbol del usuario, sus `sharedBudgets`, el enlace del estimador y los metadatos de Auth. Excluye tokens y hashes push. Botón «Descargar mis datos» en Mi cuenta.
- **Retención.** `applyRetentionPolicies` (diaria, 03:30 Europe/Madrid) borra leads con más de `LEAD_RETENTION_MONTHS` (12), `sharedBudgets` con `expiresAt` numérico vencido (sin cambiar su formato) y contadores caducados, incluidos los antiguos `quoteEstimateRateLimits`/`quoteLeadRateLimits` sin uso en 2 días. Se borra en lotes de 300, máximo 6.000 por colección y día. La TTL nativa de `sharedBudgets` necesitaría un `Timestamp`; se valorará al cerrar el modelo BC3.
- **Aceptación legal.** El registro exige marcar las condiciones y la privacidad; `users/{uid}.legalAcceptance` guarda la versión (`LEGAL_TERMS_VERSION`) y la hora del servidor. Las páginas públicas `/legal/privacidad`, `/legal/condiciones`, `/legal/aviso-legal` y `/legal/cookies` son plantillas con `[COMPLETAR: …]` que el titular debe rellenar antes de abrir el registro.

### Administración

El admin es quien tiene el custom claim `admin: true`. Se asigna con `node scripts/set-admin-claim.mjs --project <id> --email <email>`: sin `--apply` sólo simula; en un proyecto real exige además `--confirm <id>` y credenciales ADC (`gcloud auth application-default login`). `--revoke` lo retira. El script refleja el valor en `accountData.isAdmin` sólo como dato informativo. El usuario debe cerrar sesión y volver a entrar. La UI (`AdminGuard`, menú) lee el claim del token.

### Logo del perfil

El logo se reduce a 400 px y se codifica en WebP (JPEG si el navegador no codifica WebP), bajando la calidad hasta quedar por debajo de 150.000 caracteres. Las reglas de `profile/data` validan campos, longitudes, URL HTTPS de privacidad y un logo `data:image/(webp|jpeg|png)` de hasta 200.000 caracteres. El índice de `profile.logo` está exento.

Alternativa con Storage, no aplicada para no añadir un servicio: guardar el original en `users/{uid}/logo.webp` con reglas por UID y tamaño, y en Firestore sólo la ruta; para los enlaces públicos, copiar una miniatura inmutable en `public/logos/{token}.webp` o seguir embebiendo la miniatura acotada. Exige `storage.rules`, tests en emulador, CORS para el PDF y borrar los ficheros en `deleteAccount`.

### Notificaciones

`registerPushDevice` acepta `platform: web | ios | android` (por defecto `web`) y lo guarda en el dispositivo. La web mantiene el payload sólo de datos, porque el service worker muestra el aviso; iOS y Android reciben `notification`, `data`, `apns` (sonido, prioridad 10, caducidad 1 h) y `android` (prioridad alta, canal `leads`). `cleanupPushDevices` (lunes 04:00) revoca dispositivos sin actividad en 270 días o pendientes de recuperación más de 60, por la misma vía que la revocación manual. El error de FCM sigue retirando el token al instante.

### Observabilidad

Todas las Functions pasan por `observe()` (`functions/src/core/observability.ts`) y registran con `firebase-functions/logger` un evento por invocación: `function_succeeded`, `function_rejected`, `function_failed`, `rate_limited`, además de `rate_limit_exceeded`, `app_check_missing`, `lead_push_throttled`, `lead_event_discarded`, `account_deleted`, `account_exported`, `retention_applied`, `push_devices_cleaned` y `push_delivery_failed`. Nunca registran UID, token, IP, email ni contenido; los identificadores van seudonimizados (`pseudonym`). Los errores inesperados llegan al cliente como `internal` con `details.reason = 'internal'`; los rechazos esperados llevan `details.reason` (`rate_limited`, `app_check_required`, `email_not_verified`, `recent_login_required`, `unauthenticated`).

### Tareas del propietario en consola o `gcloud`

No se han ejecutado. Sustituir `BILLING_ACCOUNT_ID` y el email.

```bash
# 1. Presupuesto de facturación con avisos al 50, 90 y 100 %
gcloud billing budgets create --billing-account=BILLING_ACCOUNT_ID \
  --display-name="BudGenerator mensual" --budget-amount=25EUR \
  --filter-projects=projects/budgenerator \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0

# 2. PITR (7 días) y backups programados
gcloud firestore databases update --database='(default)' --enable-pitr --project=budgenerator
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=daily --retention=14d --project=budgenerator
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=weekly --day-of-week=SUN --retention=8w --project=budgenerator
gcloud firestore backups schedules list --database='(default)' --project=budgenerator

# 3. Canal de avisos y métricas basadas en logs
gcloud beta monitoring channels create --display-name="Propietario" --type=email \
  --channel-labels=email_address=PROPIETARIO@EXAMPLE.COM --project=budgenerator
for event in function_failed rate_limit_exceeded app_check_missing lead_push_throttled; do
  gcloud logging metrics create "bg_${event}" --project=budgenerator \
    --description="BudGenerator ${event}" \
    --log-filter="resource.type=\"cloud_run_revision\" AND jsonPayload.event=\"${event}\""
done

# 4. Alerta: algún function_failed en 5 minutos (repetir con otras métricas y umbrales)
cat > /tmp/bg-alert-failed.json <<'JSON'
{
  "displayName": "BudGenerator: errores de Functions",
  "combiner": "OR",
  "conditions": [{
    "displayName": "function_failed > 0",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/bg_function_failed\" AND resource.type=\"cloud_run_revision\"",
      "comparison": "COMPARISON_GT", "thresholdValue": 0, "duration": "0s",
      "aggregations": [{ "alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_SUM" }]
    }
  }],
  "notificationChannels": ["projects/budgenerator/notificationChannels/CHANNEL_ID"]
}
JSON
gcloud alpha monitoring policies create --policy-from-file=/tmp/bg-alert-failed.json --project=budgenerator

# 5. Clave reCAPTCHA Enterprise para App Check (después, registrarla en Firebase > App Check
#    y ponerla en VITE_FIREBASE_APPCHECK_SITE_KEY del build de producción)
gcloud services enable recaptchaenterprise.googleapis.com --project=budgenerator
gcloud recaptcha keys create --web --display-name="BudGenerator web" \
  --domains=budgenerator.web.app,budgenerator.firebaseapp.com --integration-type=SCORE \
  --project=budgenerator

# 6. Comprobar las TTL (se crean al desplegar firestore:indexes)
gcloud firestore fields ttls list --project=budgenerator
```

En la consola de Firebase: Authentication > Configuración > Política de contraseñas con mínimo 8 caracteres y protección contra enumeración de emails; plantillas de email en español (verificación y restablecimiento); dominios autorizados. Asignar el claim al admin real con el script antes de desplegar las reglas nuevas, o el panel de administración quedará inaccesible. Ensayar una restauración de backup en staging cada trimestre: `gcloud firestore databases restore --source-backup=… --destination-database=restore-test`.

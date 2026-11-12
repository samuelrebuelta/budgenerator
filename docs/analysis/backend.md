# Análisis del back de BudGenerator

Fecha: 11-11-2026. Revisión de `main` en `59d00d2` (worktree `claude/project-analysis-improvement-914b89`).
Alcance: Cloud Functions (`functions/`), `firestore.rules`, `firestore.indexes.json`, configuración Firebase, scripts de despliegue, CI y la capa de acceso a datos del cliente (`src/entities/*/api`, `src/shared/firebase`).
No se ha consultado ni modificado producción. La [auditoría de 04-10-2026](../project-analysis.md) no se repite; la sección 9 indica qué sigue pendiente de ella.

## Verificaciones ejecutadas

| Comando                                                                                                                      | Resultado                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build:functions` sin dependencias de `functions/` instaladas                                                           | Falla: no encuentra `firebase-admin`, `firebase-functions` ni los tipos de Node                                                         |
| `pnpm --dir functions install --frozen-lockfile --offline` y después `pnpm build:functions`                                  | Correcto. Aviso: el motor declarado es Node 22 y el local es Node 24.14                                                                 |
| `firebase emulators:exec --config firebase.notifications-test.json --project demo-cimbra --only firestore "pnpm test:rules"` | **77/77 pruebas de reglas correctas** en 13 ficheros. Se usaron los puertos alternativos porque el 9199 estaba ocupado por otro proceso |
| `pnpm test:notifications:emulator`                                                                                           | **15/15** de integración de notificaciones y **2/2** de reglas de notificaciones                                                        |
| `gh run list` (solo lectura)                                                                                                 | **Los últimos 9 runs de CI en `main` fallan** (del 18-10-2026 al 08-11-2026). El último correcto es del 17-10-2026                      |

No se ejecutaron `pnpm test:e2e` ni `pnpm test:integration` completos, porque quedan fuera del alcance del back y el puerto 9199 estaba ocupado.

---

## 1. Resumen ejecutivo

El back está bien defendido en los puntos que ya tuvieron incidentes: escalada de plan o admin, cuota Free, enumeración de enlaces públicos y aislamiento entre cuentas. Las Functions del estimador y de las notificaciones son pequeñas y defensivas, con idempotencia, leases, TTL y validación manual estricta.

Lo que todavía no es profesional está alrededor del código:

- No hay entorno de staging y la CI está rota.
- No hay App Check, backups verificables, alertas ni borrado de cuenta.
- Mucha lógica de negocio sigue en el cliente: numeración, importes de proyecto y escrituras de "último que escribe gana".
- Las reglas no validan el esquema de los documentos de mayor volumen.

| Área                           | Nota | Comentario                                                                                                                                                                                                                         |
| ------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Modelo de datos             | 6/10 | Árbol por usuario y subcolecciones de proyecto correctos. Hay documentos que crecen sin límite real (catálogo único, logo en data URL, presupuesto) y no hay `schemaVersion` en las entidades principales                          |
| 2. Firestore Rules             | 7/10 | Fuertes en privilegios, cuota e invariantes de proyecto, con 77 tests. Sin validación de esquema en presupuestos, plantillas, catálogo, perfil, alta de proyecto ni progreso. Son 616 líneas en un solo fichero, con mucho `get()` |
| 3. Cloud Functions             | 7/10 | Idempotencia, leases, backoff y TTL bien resueltos. Faltan App Check, límites globales, logs estructurados y `timeoutSeconds`/`memory` explícitos. La región difiere de la de Firestore                                            |
| 4. Lógica en servidor          | 4/10 | La cuota está protegida por reglas, pero la numeración, los totales de proyecto, la publicación de snapshots y el borrado no tienen autoridad de servidor                                                                          |
| 5. Consistencia                | 6/10 | Hay transacciones en casi todas las operaciones compuestas. Presupuesto, catálogo y perfil sobrescriben el documento entero sin control de versión entre dispositivos                                                              |
| 6. Operación y RGPD            | 3/10 | Un solo proyecto para producción y pruebas, despliegue manual desde ramas sin integrar, CI rota y sin backups, alertas ni flujos RGPD (borrado o retención)                                                                        |
| 7. Calidad de functions        | 6/10 | TypeScript strict y código legible. Sin `node_modules` en CI, tests repartidos entre raíz y `functions/`, lint con globals de navegador, Node 22 cercano a su fin de soporte                                                       |
| 8. Preparación para app nativa | 4/10 | Las callables sirven tal cual. El dominio (alta de presupuesto, conversión, ampliaciones) solo existe como código web contra Firestore. Falta payload push nativo, borrado de cuenta y contratos versionados                       |

**Nota global aproximada: 5,4/10.** El código es sólido para un MVP. La operación y la gobernanza no lo son todavía.

### Top 10 riesgos

| #   | Riesgo                                                                                                                                                                                             | Severidad  | Evidencia                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | La CI de `main` falla desde el 18-10-2026. Las reglas y los E2E no se validan en ningún PR                                                                                                         | Crítica    | `.github/workflows/ci.yml:23-27`; `tests/fcmDelivery.test.ts:2` importa `functions/src` sin dependencias instaladas                    |
| 2   | Producción y pruebas comparten el proyecto `budgenerator`, y se despliega a mano desde ramas no integradas                                                                                         | Alta       | `.firebaserc:3`; `docs/firebase.md:126-134` ("desde `codex/bg011-equipo-agenda`")                                                      |
| 3   | El registro abierto no tiene App Check, verificación de email ni cuotas de almacenamiento. Una cuenta automatizada puede escribir sin límite en plantillas, catálogo, `sharedBudgets` y `teamJobs` | Alta       | `firestore.rules:585-592`, `598-606`; `src/entities/auth/api/firebase.ts:18-20`                                                        |
| 4   | Los endpoints públicos no tienen App Check, captcha ni límite global. Con un token válido se pueden enviar 240 leads basura al día, con sus push                                                   | Alta       | `functions/src/quoteEstimator.ts:546-551`, `516-522`; `docs/firebase.md:57`                                                            |
| 5   | No hay evidencia de PITR, backups programados, alertas de presupuesto ni monitorización                                                                                                            | Alta       | Nada en el repo; `docs/firebase.md:57` lo deja como "requiere valorar"                                                                 |
| 6   | RGPD: sin borrado de cuenta, leads sin retención y snapshots públicos caducados que nunca se eliminan                                                                                              | Alta       | `firestore.rules:432`; `docs/firebase.md:57` ("no hay TTL"); `firestore.indexes.json` sin TTL para `sharedBudgets`                     |
| 7   | El logo PNG de hasta 1024 px se guarda en data URL en `profile/data` y se copia en cada `sharedBudgets`. El catálogo completo vive en un único documento. Ambos pueden superar 1 MiB               | Media-Alta | `src/entities/profile/model/store.ts:29-45`; `src/entities/budget/api/firestore.ts:112`; `src/entities/catalog/api/firestore.ts:76-89` |
| 8   | Las reglas no validan el esquema de presupuestos, plantillas, catálogo, perfil, alta de proyecto ni progreso. Aceptan importes, IVA y estados arbitrarios                                          | Media      | `firestore.rules:438-445`, `449`, `455-457`, `585-590`                                                                                 |
| 9   | La numeración del presupuesto se calcula en el cliente como `max+1` sobre la lista local. Puede duplicarse o reutilizarse                                                                          | Media      | `src/entities/budget/model/store.ts:180-182`, `249-252`                                                                                |
| 10  | Presupuesto, catálogo y perfil siguen la política "último que escribe gana" entre dispositivos. Puede perderse trabajo sin aviso                                                                   | Media      | `src/entities/budget/api/firestore.ts:33-43`; `src/entities/catalog/api/firestore.ts:46-48`                                            |

---

## 2. Modelo de datos Firestore

El inventario está en `docs/firebase.md:14-37`. Todo lo privado cuelga de `users/{uid}` y lo técnico vive en colecciones raíz que solo usa el servidor.

### Hallazgos

**M-1. Documentos que crecen hacia 1 MiB — Media-Alta**

- El perfil guarda el logo como `canvas.toDataURL('image/png')` con un lado máximo de 1024 px (`src/entities/profile/model/store.ts:29-45`). Un PNG de 1024×1024 con degradados o una foto puede pesar más de 1 MB, y en base64 crece un 33 %.
- El logo se copia íntegro en cada `sharedBudgets/{token}` (`src/entities/budget/api/firestore.ts:112`), junto al presupuesto completo.
- El catálogo es un único documento `tariffCatalogs/main-v1` con todas las partidas y conceptos embebidos (`src/entities/catalog/api/firestore.ts:76-89`).
- El presupuesto embebe hasta 200 capítulos con un número de tareas sin límite (`firestore.rules:440`).

Solo los proyectos y las asignaciones controlan su tamaño, por debajo de 900 KB (`src/entities/project/api/firestore.ts:125,216`).

- **Impacto:** cuando un documento supera el límite, la escritura falla sin solución en la UI. Un catálogo grande o un logo pesado bloquean el guardado o la publicación.
- **Propuesta:**
  1. Mover el logo a Cloud Storage con reglas por UID y guardar solo la ruta o URL. En `sharedBudgets`, referenciar una copia pública inmutable o seguir embebiendo una miniatura acotada (por ejemplo, 256 px en WebP o JPEG y menos de 60 KB).
  2. Dividir el catálogo en `tariffCatalogs/main-v1/parts/{partId}`, o como mínimo medir bytes antes de guardar, como ya se hace en proyectos.
  3. Añadir `request.resource.data.size()`, que no existe en Rules, o en su defecto un control de bytes en la API cliente, y límites de longitud en las reglas.

**M-2. Sin versionado de esquema en las entidades principales — Media**

Solo tienen `schemaVersion` `sharedBudgets` (v2), los ajustes del estimador (1 y 2) y los leads (1 y 2). Presupuestos, proyectos, catálogo y plantillas no lo tienen, y el mapper tolera nombres heredados (`sections`, `rows`, `concepts`, `tasks`) en `src/entities/budget/model/serialization.ts:13-40`. La migración del catálogo se hace en el cliente, de forma perezosa, al cargar (`src/entities/catalog/api/firestore.ts:76-89`). La colección legacy `tariffs` sigue siendo legible y borrable por el cliente (`firestore.rules:586,591`).

- **Impacto:** cada cliente (web y futura nativa) tiene que conocer todas las variantes históricas. No se sabe cuántos documentos quedan en formato antiguo.
- **Propuesta:** añadir `schemaVersion` en las escrituras nuevas, crear un script de migración Admin SDK idempotente con _dry-run_, ejecutable primero en staging, y retirar los alias legacy cuando el recuento llegue a cero.

**M-3. Mezcla de tipos de fecha y de dinero — Media**

- Las fechas de auditoría son cadenas ISO generadas en el cliente (`createdAt`, `assignedAt`), pero leads, dispositivos y jobs usan `serverTimestamp()`.
- El vencimiento premium existe en ISO y en milisegundos (`firestore.rules:14-22`).
- Los importes de proyecto y de ampliaciones son `number` en euros con tolerancia `±0,01` (`firestore.rules:218-220`), mientras que el estimador usa céntimos enteros.

- **Impacto:** las fechas del cliente no son fiables para auditoría ni ordenación. Los floats acumulan error al sumar ampliaciones y anulaciones, y la tolerancia de las reglas lo oculta.
- **Propuesta:** fijar un contrato de dinero en céntimos enteros (`*_cents`) para importes nuevos y fechas de servidor (`request.time` en reglas o `serverTimestamp`) para auditoría. Documentarlo en `docs/firebase.md`.

**M-4. Lecturas de colección completa y N+1 — Baja (hoy) / Media (escala)**

- `fetchBudgets`, `fetchProjects`, `fetchTemplates` y `fetchLeads` leen la colección entera sin `limit` (`src/entities/budget/api/firestore.ts:28-31`, `src/entities/project/api/firestore.ts:331-336`, `src/entities/quote-estimator/api/firestore.ts:98`).
- El panel de admin lee **toda** la colección `users` (`src/entities/user/api/firestore.ts:31-34`).
- `teamJobs` hace una consulta de asignaciones por trabajo (`src/entities/workforce/api/firestore.ts:84-95`).
- `fetchProject` hace 5 lecturas de colección.

- **Propuesta:** paginar con `orderBy(createdAt).limit()`. Este punto sigue pendiente de la auditoría de octubre. Para el admin, crear una callable paginada. Para `teamJobs`, desnormalizar las asignaciones en el documento del trabajo, ya que son inmutables según `firestore.rules:561,567`.

**M-5. Índices — Baja**

`firestore.indexes.json` solo declara índices de `leadNotificationJobs` y el TTL de `retentionExpiresAt`. Las consultas actuales del cliente (rango sobre `date` en `teamJobs`) funcionan con índices simples automáticos. El fichero no se despliega con `scripts/deploy.mjs:6`, que solo admite `hosting` y `firestore:rules,hosting`, así que puede divergir de producción.

- **Propuesta:** incluir `firestore:indexes` en el script de despliegue y fijar las exenciones de índice para campos grandes (`workItems`, `parts`, `tasks`, `logo`), para ahorrar coste de escritura.

**M-6. Desnormalización sin reconciliación — Baja**

El proyecto copia del presupuesto el cliente, el título y los importes. La asignación copia el nombre del miembro y la etiqueta de la cuadrilla. Un renombrado de un miembro no se propaga a las asignaciones existentes. Es intencionado (snapshot), pero no está documentado como tal para los snapshots de asignación.

---

## 3. Firestore Rules

### Fortalezas verificadas

- La raíz `users/{uid}` no tiene comodín recursivo. El alta solo es free y no admin, con contador a 0 (`firestore.rules:420-426`).
- El cliente no puede cambiar `isAdmin` (`firestore.rules:427-431`).
- La cuota Free está ligada al par presupuesto/contador con `getAfter` (`firestore.rules:24-34`, `438-444`).
- La conversión a proyecto, las ampliaciones y las anulaciones se validan como invariantes cruzadas entre documentos (`firestore.rules:225-397`).
- Las colecciones de servidor están cerradas (`firestore.rules:610-614`).
- Los leads no se pueden crear desde el cliente y solo permiten enlazar `budgetId` (`firestore.rules:575-584`).
- Las 77 pruebas pasan en el emulador.

### Hallazgos

**R-1. Sin validación de esquema en los documentos de más volumen — Media**

- **Presupuestos.** El alta solo comprueba `id`, `info is map`, `workItems is list` con un máximo de 200, y la ausencia de `acceptedAt` y `projectId` (`firestore.rules:438-444`). La edición acepta cualquier clave nueva y cualquier valor, salvo `id` y `createdAt` (`firestore.rules:398-416`). Se pueden guardar precios negativos, un `ivaRate` arbitrario o `adjustment` por encima del 100 %.
- **Plantillas, catálogo, perfil y `settings/*`.** El comodín de escritura no valida nada (`firestore.rules:585-590`). Eso incluye la `privacyPolicyUrl` del perfil, que luego se publica en el estimador público. La función la valida en `functions/src/quoteEstimator.ts:248,469`, pero el dato persiste sin validar.
- **Ajustes del estimador.** Se aceptan con cualquier contenido (`firestore.rules:573`). La función los valida al leerlos (`functions/src/quoteEstimator.ts:108-116`), así que un ajuste inválido rompe el enlace público con `failed-precondition` en lugar de rechazarse al guardar.
- **Alta de proyecto.** Solo se valida `id`, `sourceBudgetId` y el enlace (`firestore.rules:41-51`). `subtotal`, `iva`, `total`, `workItemCount` y `totalConcepts` vienen del cliente sin contrastarse con el presupuesto. Los capítulos (`workItems`) del alta no se validan (`firestore.rules:480-488`).
- **Progreso.** Se permite cambiar `completedConcepts`, `completedAmount`, `percent`, `status` y `completedAt` a cualquier valor (`firestore.rules:455-457`). Un proyecto se puede marcar `completed` al 3 %.
- **Cuadrillas.** `memberIds is list` sin límite de tamaño ni tipo (`firestore.rules:112`).
- **Asignaciones.** En las de cuadrilla solo se valida `members[0]` contra la fuente (`firestore.rules:136-140`). En `dailyAssignments.assignments` no se validan los elementos (`firestore.rules:168`), algo que ya está documentado.

- **Impacto:** los datos malformados rompen la UI, los cálculos y el PDF en cualquier cliente. Con una app nativa en paralelo, el riesgo crece: dos clientes y ningún contrato aplicado en el servidor. La manipulación afecta solo a los datos propios, así que no es una brecha entre cuentas.
- **Propuesta:** crear funciones `validBudget(data)`, `validTemplate`, `validCatalog`, `validProfile` y `validEstimatorSettings` con `keys().hasOnly`, tipos, rangos (`price >= 0`, `ivaRate in [0, 0.04, 0.1, 0.21]`, `adjustment` acotado) y longitudes. Para los arrays anidados, que Rules no puede recorrer, acotar el tamaño y validar en la API de servidor (ver la sección 5). Para el progreso, exigir `status == projectProgressStatus(completedConcepts, totalConcepts)` y que el porcentaje sea coherente, igual que ya se hace con las ampliaciones.

**R-2. Admin identificado por un email fijo en las reglas — Media**

`isAdmin()` compara `request.auth.token.email == 'budgenerator@gmail.com'` y lee el documento del usuario en cada evaluación (`firestore.rules:8-11`). No comprueba `email_verified`. Cada `canUse()` de admin cuesta un `get()` adicional.

- **Impacto:** el admin no puede rotarse ni haber más de uno sin desplegar reglas. Cuenta contra el límite de `get()` por petición. El admin puede leer y modificar presupuestos y proyectos de **todos** los usuarios (`canUse` en `firestore.rules:434,445,448,450`), que contienen datos personales de sus clientes.
- **Propuesta:** usar _custom claims_ (`request.auth.token.admin == true`) asignadas con una función o script Admin SDK y auditadas. Limitar el admin a lectura de `users/{uid}` y a cambios de plan. El acceso a presupuestos ajenos debe ser explícito y quedar registrado, o eliminarse.

**R-3. `sharedBudgets` sin límites de cantidad ni de contenido — Media**

Cualquier usuario autenticado puede crear snapshots públicos sin límite (`firestore.rules:598-606`). No se comprueba que `budget.id` exista en su cuenta. `workItems` y `company.logo` no tienen tamaño acotado. No hay TTL: `expiresAt` es un `int` y Firestore TTL exige un `Timestamp`, así que los documentos caducados quedan para siempre con nombre y dirección del cliente final. Borrar el presupuesto no revoca sus enlaces.

- **Impacto:** se puede alojar contenido arbitrario bajo `budgenerator.web.app/shared/...` (phishing con la marca de la empresa), crece el almacenamiento y se retienen datos personales sin plazo.
- **Propuesta:**
  - Añadir `expiresAtTs` (`timestamp`) con una política TTL.
  - Exigir `exists(/users/$(uid)/budgets/$(budget.id))` y limitar los enlaces activos por presupuesto, guardando `sharedTokens` en el presupuesto o con una callable `shareBudget`.
  - Al borrar un presupuesto, revocar sus enlaces mediante un trigger `onDocumentDeleted`.

**R-4. Mantenibilidad del fichero de reglas — Media**

Son 616 líneas en un único fichero que mezcla cuenta, presupuesto, proyecto, ampliaciones, equipo, estimador y enlaces públicos. Las funciones de ampliación encadenan muchos `get()` y `getAfter()` sobre los mismos documentos (`firestore.rules:225-397`). Firestore limita los accesos a 10 en peticiones de un documento y 20 en transacciones o batches. Las ampliaciones y anulaciones ya tocan proyecto, capítulo, ampliación y anulación en la misma transacción.

- **Impacto:** cada nueva invariante acerca a ese límite, y un fallo por límite se manifiesta como `permission-denied` difícil de diagnosticar.
- **Propuesta:**
  - Mover las invariantes multi-documento más complejas (ampliación, anulación, conversión) a callables con Admin SDK y dejar en Rules solo `allow write: if false` para esos documentos.
  - Separar el fichero por dominios, con un ensamblado en build si se quiere mantener un solo artefacto.
  - Añadir un test que ejecute el caso de mayor número de `get()`.

**R-5. Huecos de cobertura de tests de reglas — Media**

Hay 77 tests: `security` (17), `teamJobs` (9), `projectAssignments` (8) y otros. No hay casos para:

- El comodín de `tariffCatalogs`, `templates`, `profile` y `settings`, incluida la denegación de `settings/notifications` como escritura del cliente. Solo `notifications.rules.test.ts` cubre la lectura.
- El tamaño y el contenido de `sharedBudgets`.
- El acceso del admin a subcolecciones de otros usuarios (proyectos, `workItems`).
- La denegación del borrado de `users/{uid}`.
- Progreso incoherente.

- **Propuesta:** escribir una matriz de tests por colección y actor (anónimo, propietario, otro usuario, admin) generada desde una tabla, para que cada colección nueva obligue a añadir su fila.

**R-6. Detalles menores — Baja**

- Cada `get` de `sharedBudgets` sobre un token inexistente evalúa `resource.data` nulo y se deniega. Es correcto, pero el cliente no distingue "no existe" de "caducado"; es un detalle de UX.
- La lectura de `settings/*` incluye `notifications` (`firestore.rules:586`). Es aceptable porque solo contiene `pushEnabled` y fechas.
- `budgets` admite `delete` por el admin (`firestore.rules:435`).

---

## 4. Cloud Functions

Hay 13 funciones v2 en `europe-west1`: 6 callables del estimador, 4 callables de notificaciones, 1 trigger `onDocumentCreated` y 2 tareas programadas (`functions/src/index.ts`, `functions/src/notifications/leadCreated.ts`).

### Fortalezas

- Token público de 24 bytes aleatorios (`quoteEstimator.ts:271`) con validación por regex.
- Lead idempotente por `sha256(uid:token:idempotencyKey)` y `requestHash` para detectar reenvíos distintos (`quoteEstimator.ts:487-515`).
- DTO público mínimo, sin UID, precios ni coste.
- Cola de notificaciones con IDs deterministas, `batch.create` idempotente (`jobs.ts:119-140`), _lease_ transaccional (`worker.ts:111-178`), máximo 5 intentos, backoff con jitter, horizonte de 6 h y TTL de 30 días.
- El worker vuelve a comprobar lead, usuario, preferencia y dispositivo antes de enviar. Los tokens inválidos se retiran (`worker.ts:249-259`, `preferences.ts:282-331`).
- Los logs no contienen datos personales (`fcm.ts:46`).

### Hallazgos

**F-1. Sin App Check ni protección anti-bot en las callables públicas — Alta**

`quoteEstimatorFunctionOptions` no declara `enforceAppCheck` (`functions/src/quoteEstimator.ts:546-551`) y el cliente no inicializa App Check (no aparece `AppCheck` en `src/`). Los límites son por token:

- 20 por minuto para resolución y cálculo (`quoteEstimator.ts:46-47`, `353-376`).
- 10 leads por hora (`quoteEstimator.ts:516-522`).

Los tokens inválidos siguen costando una invocación y una lectura (`docs/firebase.md:57`). El único techo global es `maxInstances: 10`.

- **Impacto:** quien conozca un enlace público, que es público por diseño, puede generar 240 leads al día con datos personales falsos, 240 push al dueño y lecturas y escrituras facturables. La horquilla de precios es extraíble por fuerza bruta a 20 cálculos por minuto, algo ya documentado.
- **Propuesta:**
  1. Activar App Check con reCAPTCHA Enterprise en web y Play Integrity o App Attest en la app nativa. Empezar en modo monitor y pasar después a `enforceAppCheck: true` y `consumeAppCheckToken: true` en `submitPublicLead`.
  2. Añadir un límite global diario por propietario en `quoteLeadRateLimits/{uid}`.
  3. Añadir un campo trampa (_honeypot_) y un tiempo mínimo de formulario.
  4. Crear una alerta cuando un token supere el umbral.

**F-2. Región de Functions distinta de la de Firestore — Media**

Las Functions están en `europe-west1` (`quoteEstimator.ts:44`, `leadCreated.ts:13`, `preferences.ts:21`) y la base de datos en `europe-southwest1` (`docs/firebase.md:82`). Cada callable pública encadena de 4 a 7 lecturas y 1 o 2 transacciones secuenciales entre regiones. El trigger de Firestore depende de Eventarc entre regiones.

- **Impacto:** la latencia del estimador aumenta varias decenas de milisegundos por operación, hay coste de tráfico entre regiones y se añade un punto de fallo.
- **Propuesta:** verificar la disponibilidad de Cloud Run functions en `europe-southwest1` y migrar las funciones de forma escalonada: desplegar con un nombre nuevo, cambiar `getFunctions(app, region)` en `src/shared/firebase/config.ts:19` y borrar las antiguas. Centralizar la región en una constante compartida, que hoy está repetida en 4 sitios.

**F-3. Sin logs estructurados ni gestión de errores observable — Media**

Solo `fcm.ts:46` registra algo. Las excepciones no `HttpsError` de `quoteEstimator.ts` (fallos de Firestore o de transacciones) llegan al cliente como `internal` y no quedan registradas con contexto. No hay métricas de leads aceptados o rechazados, de límites alcanzados ni de jobs `failed`.

- **Propuesta:** crear un `logger` con un campo `event` (por ejemplo `lead_submitted`, `rate_limited`, `job_failed`) y un hash corto del token, nunca el token, el UID ni el contacto. Crear métricas basadas en logs y alertas en Cloud Monitoring: errores 5xx, `resource-exhausted` y jobs `failed` en 24 h.

**F-4. Configuración de ejecución implícita — Baja**

No se fijan `timeoutSeconds`, `memory` ni `concurrency`, así que se aplican los valores por defecto de v2: 60 s, 256 MiB y concurrencia 80. Con `minInstances: 0` hay arranques en frío en cada visita esporádica al estimador público. Las tres callables públicas se despliegan como servicios separados, cada uno con su propio arranque en frío.

- **Propuesta:** fijar `timeoutSeconds: 15` en las callables públicas y `memory: '256MiB'`. Valorar agrupar las callables públicas en una sola función con un discriminador de operación si los arranques en frío se notan. Mantener `minInstances: 0` mientras el tráfico sea bajo; documentar el coste antes de subirlo.

**F-5. Reintentos del trigger sin límite de antigüedad — Baja**

`processNewLeadNotifications` usa `retry: true` (`leadCreated.ts:26`) sin comprobar la edad del evento. Un error persistente reintenta durante días. Los jobs caducan a las 6 h, así que no hay envíos tardíos, pero sí invocaciones inútiles.

- **Propuesta:** descartar eventos con `Date.now() - Date.parse(event.time) > 6h` y registrarlos.

**F-6. Higiene de datos del estimador — Baja**

- `revokePublicEstimator` borra `quoteEstimateRateLimits/{token}` pero no `quoteLeadRateLimits/{token}` (`quoteEstimator.ts:292-304`). Ninguna colección de límites tiene TTL, así que acumulan documentos huérfanos.
- `getActiveOwner` lee el token y `enforceRateLimit` lo vuelve a leer en una transacción. Son 2 lecturas por llamada, cuando podría devolver `ownerUid` desde la transacción.
- Publicar el estimador no depende del plan. Es coherente con BG-004 aplazado, pero conviene dejarlo como decisión explícita.

**F-7. Push y FCM — Media**

- Los tokens solo se retiran cuando FCM devuelve `not-registered` o `invalid` (`worker.ts:249-259`). No hay limpieza por inactividad: `lastSeenAt` existe en `preferences.ts:228`, pero ningún proceso lo usa. Firebase recomienda refrescar el token cada mes y descartar los inactivos más de unos 270 días.
- El mensaje solo lleva datos, con `webpush.headers.TTL` (`fcm.ts:37-41`). En iOS y Android nativos, un mensaje solo de datos no muestra notificación con la app cerrada; hace falta un bloque `notification` y `apns`/`android`.
- Todavía se mantiene el soporte de FID legacy (`contracts.ts:61-69`, `fcm.ts:36`).

- **Propuesta:**
  - Crear una tarea programada mensual que deshabilite dispositivos con `lastSeenAt` de más de 60 días y borre los de más de 270.
  - Hacer que el cliente llame a `registerPushDevice` en cada arranque, como ya ocurre al iniciar sesión, para actualizar `lastSeenAt`.
  - Construir el mensaje según la plataforma registrada en el dispositivo, con un campo nuevo `platform: web|ios|android`.
  - Retirar el FID legacy cuando no queden filas.

**F-8. Secretos — Correcto**

No hay secretos de servidor: FCM usa las credenciales por defecto del runtime. La VAPID es pública y solo vive en `.env` (`.env.example:9`), y `.env*` está en `.gitignore`. Cuando se añada Stripe o email, usar `defineSecret` (Secret Manager), nunca variables de entorno en texto.

---

## 5. Lógica que debería pasar al servidor

| Operación                                                        | Dónde vive hoy                                                                                                    | Riesgo de confiar en el cliente                                                                                                                                                | Propuesta                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numeración del presupuesto                                       | `src/entities/budget/model/store.ts:180-182`, como `max+1` sobre la lista cargada                                 | Duplicados entre dos dispositivos. Reutiliza el número tras borrar el último. Es incompatible con una numeración correlativa futura, que haría falta para facturar (Verifactu) | Contador `nextBudgetNumber` en `users/{uid}`, incrementado en la misma transacción de alta (o callable `createBudget`). En Rules: `after.nextBudgetNumber == before.nextBudgetNumber + 1` y `budget.info.budgetNumber == before.nextBudgetNumber` |
| Alta con cuota                                                   | Transacción del cliente (`src/entities/budget/api/firestore.ts:54-94`) protegida por reglas                       | Bien protegida. El cliente calcula el premium con la fecha ISO y las reglas con milisegundos (`firestore.rules:18-23`), así que la UI puede mostrar un límite distinto         | Mantener las reglas o mover el alta a una callable. Unificar el vencimiento en un `Timestamp`                                                                                                                                                     |
| Totales del proyecto (`subtotal`, `iva`, `total`, `totalAmount`) | `prepareProjectSnapshot` en el cliente; las reglas no lo contrastan (`firestore.rules:41-51`)                     | Las cifras del proyecto pueden no coincidir con el presupuesto aceptado. El progreso es arbitrario (`firestore.rules:455-457`)                                                 | Callable `convertBudgetToProject` que calcule con `budgetMath` compartido (ya se compila en `functions/` vía `tsconfig.json:13-17`) y escriba con Admin SDK                                                                                       |
| Ampliaciones y anulaciones                                       | Transacción en el cliente y unas 170 líneas de reglas (`firestore.rules:225-397`)                                 | Complejidad cerca del límite de `get()`. Hay que duplicar la lógica en la app nativa                                                                                           | Callables `addProjectSupplement` y `voidProjectSupplement`, con reglas de solo lectura para esas subcolecciones                                                                                                                                   |
| Publicación de enlace público                                    | `setDoc` del cliente (`src/entities/budget/api/firestore.ts:96-119`)                                              | Contenido arbitrario, sin límite por presupuesto, sin revocación al borrar                                                                                                     | Callable `shareBudget` que construya el DTO desde el documento real (`toPublicBudget`) y limite la cantidad                                                                                                                                       |
| PDF                                                              | Cliente (jsPDF)                                                                                                   | Aceptable. Solo haría falta servidor para enviar PDF por email o firmar                                                                                                        | Mantener en cliente; reconsiderarlo si se añade envío o firma                                                                                                                                                                                     |
| Planes y administración                                          | `adminUpdateUserPlan` escribe desde el cliente (`src/entities/user/api/firestore.ts:36-55`), protegido por reglas | El email fijo y la lectura completa de `users`                                                                                                                                 | Callable `adminSetPlan` con _custom claim_ y registro de auditoría en `adminAuditLog`                                                                                                                                                             |
| Borrado de cuenta                                                | No existe                                                                                                         | Ver la sección 7                                                                                                                                                               | Callable `deleteAccount` que borre recursivamente el subárbol, `sharedBudgets` con `ownerUid`, `quoteEstimatorLinks`, tokens, `pushInstallationIndex` y el usuario de Auth                                                                        |

La cuota Free, el bloqueo de un presupuesto aceptado y la inmutabilidad de ampliaciones ya los garantiza el servidor mediante Rules. El resto son decisiones del cliente que una segunda app tendría que reimplementar exactamente igual.

---

## 6. Consistencia y concurrencia

**C-1. "Último que escribe gana" en presupuesto, catálogo y perfil — Media**

- `saveBudget` envía el documento completo con `updateDoc` (`src/entities/budget/api/firestore.ts:33-43`).
- `saveTariffCatalog` hace `setDoc` del catálogo entero (`src/entities/catalog/api/firestore.ts:46-48`).
- El perfil hace lo mismo.

La `WriteQueue` ordena dentro de la sesión, pero no entre dispositivos (`docs/state-and-cache.md:17`).

- **Impacto:** si se edita en el móvil y en el escritorio a la vez, el último guardado sobrescribe al otro sin aviso. Con una app nativa, el caso deja de ser raro.
- **Propuesta:** añadir un campo `revision` (entero) con una regla `request.resource.data.revision == resource.data.revision + 1`, y guardar en una transacción que compare la revisión leída. Ante un conflicto, la UI ofrece recargar o sobrescribir. Este patrón ya existe en `assignmentState` (`firestore.rules:172-179`).

**C-2. Uso de transacciones — Correcto, con matices**

Hay transacciones en la cuota, la aceptación, la conversión (con recuperación del ganador en `src/entities/project/api/firestore.ts:308-327`), los metadatos, las asignaciones con revisión, `ensureSingleCatalog` y todas las mutaciones del servidor.

- **Matiz:** `deleteLegacyTariffs` usa un único `writeBatch` sin dividir (`src/entities/catalog/api/firestore.ts:34-39`). Por encima de 500 tarifas falla.
- **Propuesta:** dividir en bloques de 500 o, mejor, retirarlo con la migración M-2.

**C-3. Escrituras offline — Correcto por diseño**

Las escrituras se bloquean sin red (`runNetworkMutation` y `guardNetworkMutation`) y no hay persistencia de Firestore (`docs/state-and-cache.md:25`). Así se evitan conflictos de sincronización diferida. En una app nativa con persistencia offline (por defecto en `@react-native-firebase/firestore`), C-1 se agrava y las reglas con `getAfter` rechazarán escrituras encoladas basadas en estado antiguo.

- **Propuesta:** decidir explícitamente si la app nativa desactiva la persistencia o adopta revisiones. Lo recomendado es revisiones y callables para las operaciones compuestas.

**C-4. Contador de dispositivos derivado — Baja**

`notificationDeviceCounts/{uid}` se mantiene a mano en tres caminos (`preferences.ts:184-238`, `268-274`, `323-326`). Es correcto dentro de cada transacción, pero si una ruta futura lo olvida, se desajusta.

- **Propuesta:** comparar con un `count()` en la tarea de limpieza de F-7.

---

## 7. Operación, entornos y RGPD

**O-1. CI rota desde el 18-10-2026 — Crítica**

Los tests unitarios de la raíz importan `functions/src/**` (`tests/fcmDelivery.test.ts:2`, `tests/leadNotificationJobs.test.ts:2`). Esas dependencias solo existen en `functions/node_modules`, y CI no las instala (`.github/workflows/ci.yml:23`). `pnpm test` falla con `ERR_MODULE_NOT_FOUND`, como muestra el log del run `42537388482`. Por eso `test:integration`, que incluye las reglas y los E2E, tampoco se ejecuta. Además, `test:notifications:emulator` no forma parte de la CI.

- **Impacto:** las 9 integraciones en `main` desde el 18-10 no tienen validación automática. Las reglas desplegadas se probaron solo en local.
- **Propuesta:** como mínimo, añadir `pnpm --dir functions install --frozen-lockfile` antes de los tests. Lo mejor es un workspace pnpm (`pnpm-workspace.yaml` con `functions`) y añadir `pnpm build:functions` y `pnpm test:notifications:emulator` a la CI. Proteger la rama `main` exigiendo el check en verde.

**O-2. Un solo proyecto Firebase y despliegue manual — Alta**

`.firebaserc` solo tiene `default: budgenerator`. La cuenta admin de producción se usa para pruebas (`docs/testing.md:5`). Las publicaciones se hacen desde ramas sin integrar (`docs/firebase.md:126-134`): producción ha ejecutado código que no estaba en `main`. `scripts/deploy.mjs` no despliega Functions ni índices, que se publican con la CLI a mano (`docs/firebase.md:80`), y el IAM `allUsers` de Cloud Run se configuró a mano (`docs/firebase.md:90`).

- **Propuesta:**
  1. Crear el proyecto `budgenerator-staging`, con alias en `.firebaserc` y su propio `.env.staging`.
  2. Desplegar desde CI con _workload identity federation_, con staging automático en `main` y producción mediante un tag y aprobación manual (`environment: production`).
  3. Incluir `functions`, `firestore:rules` y `firestore:indexes` en el mismo despliegue, con _smoke tests_ después.
  4. Prohibir por procedimiento el despliegue desde ramas.

**O-3. Backups y recuperación — Alta**

No hay evidencia en el repo de PITR, `gcloud firestore backups schedules` ni exportaciones. No se comprobó en producción, deliberadamente.

- **Propuesta:** activar PITR (7 días) y un backup programado diario con retención de 14 a 30 días. Documentar el procedimiento de restauración a una base de datos nueva y ensayarlo en staging cada trimestre.

**O-4. Monitorización, alertas y costes — Alta**

No hay alertas de presupuesto (documentado como pendiente en `docs/firebase.md:57`), ni Error Reporting del cliente, ni paneles. CI no publica nada.

- **Propuesta:**
  - Alerta de presupuesto de GCP al 50, 90 y 100 %.
  - Alertas de Cloud Monitoring para errores de Functions, latencia p95 de las callables públicas, jobs `failed` y lecturas por día de Firestore.
  - Captura de errores del cliente con Crashlytics en nativo o un servicio equivalente en web, decidido explícitamente porque añade una dependencia.

**O-5. RGPD — Alta**

- **Borrado de cuenta.** No existe: `allow delete: if false` en `firestore.rules:432` y no hay `deleteUser` en `src/`. El derecho de supresión es obligatorio en el RGPD y en App Store (guía 5.1.1(v)) para la app nativa.
- **Leads.** Guardan nombre, email, teléfono y selecciones sin plazo, hasta que el titular los borra (`docs/firebase.md:57`). No hay política de retención ni aviso al titular.
- **Snapshots públicos caducados.** Conservan datos del cliente final sin TTL (R-3).
- **Acceso del admin.** El admin puede leer los presupuestos de todos los usuarios (R-2), que contienen datos personales de terceros, sin registro de acceso.
- **Prueba del consentimiento.** El lead guarda `consentAt` y `privacyPolicyUrl` (`quoteEstimator.ts:523-535`), pero no la versión del texto mostrado.
- **Caché local.** IndexedDB guarda datos sin cifrar y los borra al cerrar sesión (`docs/state-and-cache.md:27`). Es aceptable; hay que documentarlo en el registro de tratamientos.
- **Bien resuelto:** no se guarda la IP, los jobs tienen un TTL de 30 días, todo está en regiones de la UE y Functions no registra datos personales.

- **Propuesta:**
  - Callable `deleteAccount`, descrita en la sección 5, con prueba en el emulador.
  - Retención configurable de leads (por ejemplo 12 meses) con un campo TTL `retentionExpiresAt`.
  - TTL en `sharedBudgets`.
  - Guardar `consentTextVersion` en el lead.
  - Exportación de datos (`exportAccountData`) para el derecho de acceso.
  - Documentar a BudGenerator como encargado del tratamiento de los leads de cada empresa usuaria.

**O-6. Documentación del contrato mezclada con el registro de despliegues — Baja**

`docs/firebase.md` (33 KB) intercala el contrato técnico con bitácoras de despliegue (`docs/firebase.md:82-136`).

- **Propuesta:** mover las bitácoras a `plan-history.md` y dejar en `firebase.md` solo el contrato vigente.

---

## 8. Calidad del código de Functions

**Q-1. Estructura y acoplamiento — Media**

`functions/tsconfig.json:6,13-17` usa `rootDir: ".."` y compila código de `src/entities/quote-estimator/model` y `src/shared/types`, de modo que la salida queda en `lib/functions/src/index.js` (`functions/package.json:5`). Reutilizar el cálculo es acertado: una sola fuente de verdad para precios. El inconveniente es que cualquier import del navegador que entre en esos módulos rompe el build de Functions, y los límites no se verifican con ninguna herramienta.

- **Propuesta:** extraer `packages/domain` (cálculos, validadores y tipos de contrato, sin dependencias de navegador) en un workspace pnpm, consumido por la web, Functions y la futura app nativa.

**Q-2. Inicialización y región duplicadas — Baja**

`initializeApp()` y `getFirestore()` se repiten en `quoteEstimator.ts:42-43`, `jobs.ts:5-6`, `worker.ts:13-14` y `preferences.ts:18-19`. La región y las opciones se repiten en tres sitios.

- **Propuesta:** crear un módulo `functions/src/core/firebase.ts` y otro `options.ts`.

**Q-3. Tests repartidos y sin cobertura de handlers del estimador — Media**

- Los tests de lógica de notificaciones están en `tests/` de la raíz.
- Los de integración están en `functions/tests` (15) y se ejecutan con una configuración de Vitest de la raíz.
- Los handlers `submitPublicLead`, `publishPublicEstimator` y `enforceRateLimit` solo se cubren con un E2E (`tests/e2e/public-estimator.spec.ts:98`) y tests de modelo. No hay tests de idempotencia del lead, del `requestHash` distinto, del límite de 10 por hora ni de la revocación.

- **Propuesta:** crear tests de integración con los emuladores de Firestore y Auth para cada callable, con la misma estructura que `notificationPreferences.integration.test.ts`, y dar a `functions/package.json` su propio script `test`.

**Q-4. Lint y tipos — Baja**

ESLint de la raíz aplica `globals.browser` también a `functions/src` (`eslint.config.js:18-20`). `functions/package.json` no declara `@types/node` y depende de que llegue de forma transitiva. Los `as` sobre datos de Firestore son frecuentes (`quoteEstimator.ts:119,234,262`) y no hay validación al leer.

- **Propuesta:** crear un bloque ESLint para `functions/**` con `globals.node`, añadir `@types/node@22` y activar `noUncheckedIndexedAccess`.

**Q-5. Versiones — Baja**

- Runtime Node 22: su fin de soporte (LTS) es el 30-04-2027. Planificar Node 24 antes del primer trimestre de 2027.
- CI usa Node 24 (`ci.yml:17`) y Functions Node 22, una discrepancia que ya avisa el build.
- `firebase-admin` está fijado a `14.1.0`; `firebase-functions` usa `^7.4.0`.
- `@google-cloud/functions-framework` es dependencia directa solo por el build remoto con pnpm (`docs/firebase.md:80`); hay que documentarlo en `package.json`.

- **Propuesta:** Renovate o Dependabot con agrupación de Firebase, y Node 22 en la CI para el job de Functions.

---

## 9. Pendientes de la auditoría del 04-10-2026 relacionados con el back

| Hallazgo de entonces                                                                                               | Estado                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Escalada de admin y plan, colección pública enumerable, cuota no atómica                                           | **Resuelto** y cubierto por tests                                                         |
| "Stores y tipos sin validación remota"                                                                             | **Pendiente**: R-1                                                                        |
| "Colecciones completas y usuarios legacy secuenciales" (paginación)                                                | **Pendiente**: M-4                                                                        |
| "No hay CI o mecanismo de versión de esquema"                                                                      | La CI existe pero **está rota** (O-1). El versionado de esquema sigue **pendiente** (M-2) |
| Migración administrativa de premium ISO a milisegundos y revisión de planes y contadores editados antes del cierre | **Sin evidencia** de ejecución en el repo. Requiere un script Admin SDK con _dry-run_     |
| "PWA sin escrituras en caché" (alcance offline)                                                                    | Decidido (BG-012: sin cola). Hay que reabrirlo para la app nativa (C-3)                   |

---

## 10. Preparación para la app nativa (React Native)

Lo que ya sirve:

- Las callables (estimador y notificaciones) se consumen igual desde `@react-native-firebase/functions`.
- Las reglas protegen los invariantes críticos con independencia del cliente.

Lo que falta:

1. **API de dominio en servidor.** Alta de presupuesto, conversión, ampliaciones, anulación, compartir, borrado de cuenta y cambio de plan, como callables con contratos tipados (sección 5). Sin ellas, la app nativa tiene que duplicar unas 950 líneas de `src/entities/project/api/firestore.ts` y respetar reglas que solo se descubren al fallar.
2. **Paquete de contratos compartido** (`packages/domain`): tipos, validadores, `budgetMath` y DTOs, más un campo `apiVersion` en las peticiones de callables para poder evolucionar sin romper clientes antiguos que no se actualizan.
3. **Push nativo.** Registro con `platform`, mensaje con `notification`/`apns`/`android`, gestión de canales en Android, deep link `leadId` y limpieza por inactividad (F-7).
4. **App Check** con App Attest y Play Integrity antes de publicar.
5. **Borrado de cuenta** dentro de la app, obligatorio para App Store.
6. **Política offline y conflictos** (C-1 y C-3), con revisiones por documento.
7. **Deep links** para `/shared/:token`, el estimador público y leads, con un dominio de _universal links_ o _app links_ configurado en Hosting (`apple-app-site-association`, `assetlinks.json`).
8. **Logo y archivos en Storage** (M-1). Los data URL de varios cientos de KB perjudican la memoria y la red en móvil.
9. **Fechas y dinero normalizados** (M-3), para que dos clientes no difieran en redondeos.

---

## 11. Plan por fases

Las estimaciones son para una persona con experiencia en Firebase e incluyen tests y documentación.

### Fase 0 — Recuperar el control (2-3 días)

- Arreglar la CI: instalar las dependencias de `functions` o crear un workspace pnpm, y añadir `build:functions` y `test:notifications:emulator`. Exigir el check en `main` (O-1).
- Activar PITR, backups diarios y alertas de presupuesto (O-3 y O-4). Requiere permisos de proyecto y la decisión del titular.
- Añadir `firestore:indexes` y `functions` a `scripts/deploy.mjs` (M-5 y O-2).
- **Criterio de salida:** CI en verde en `main`, backups activos verificados y alerta de presupuesto creada.

### Fase 1 — Entornos y abuso (1-2 semanas)

- Crear el proyecto de staging, el despliegue desde CI con aprobación y el procedimiento de _smoke tests_ (O-2).
- Activar App Check en web, primero en modo monitor y después en `submitPublicLead` y `calculatePublicEstimate`, con límite global por propietario y campo trampa (F-1).
- Añadir logs estructurados, métricas y alertas (F-3).
- Exigir verificación de email antes de publicar enlaces o el estimador (R-3 y F-1).
- **Criterio de salida:** ningún despliegue a producción sin pasar por staging y CI, y un ataque simple de bot contra el estimador queda bloqueado o registrado.

### Fase 2 — Datos y RGPD (2-3 semanas)

- Crear las callables `deleteAccount` y `exportAccountData`, con TTL en `sharedBudgets` y retención de leads (O-5 y R-3).
- Mover el logo a Storage y medir o dividir el catálogo (M-1).
- Validar el esquema en las reglas de presupuesto, plantilla, catálogo, perfil, estimador y progreso, con una matriz de tests (R-1 y R-5).
- Añadir `revision` en presupuesto, catálogo y perfil (C-1).
- Numeración en servidor (sección 5).
- Pasar el admin a _custom claims_ con auditoría (R-2).
- **Criterio de salida:** los datos malformados se rechazan en el servidor, un usuario puede borrar su cuenta por completo y no hay documentos que puedan superar 1 MiB.

### Fase 3 — API de dominio y preparación nativa (4-6 semanas)

- Crear `packages/domain` compartido (Q-1).
- Crear las callables `createBudget`, `convertBudgetToProject`, `addProjectSupplement`, `voidProjectSupplement`, `shareBudget` y `adminSetPlan`, y simplificar las reglas a solo lectura donde corresponda (sección 5 y R-4).
- Añadir `schemaVersion` y una migración Admin SDK con _dry-run_ (M-2). Pasar el dinero a céntimos en las entidades nuevas (M-3).
- Push multiplataforma y limpieza de tokens (F-7).
- Alinear la región de Functions con Firestore (F-2) y migrar a Node 24 (Q-5).
- **Criterio de salida:** una segunda app puede operar el dominio solo con callables y lecturas, sin reimplementar invariantes.

**Total orientativo: de 8 a 12 semanas** de trabajo efectivo. Las fases 0 y 1 son prerrequisito para empezar la app nativa.

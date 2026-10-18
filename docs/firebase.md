# Firebase

Servicios utilizados: Authentication con email/contraseña, Firestore, Hosting y Cloud Functions para el estimador público. No hay Storage, servidor propio o pasarela de pagos en este checkout.

## Configuración

`shared/firebase/config.ts` utiliza las variables `VITE_FIREBASE_*` de `.env.example`. Con `VITE_USE_FIREBASE_EMULATORS=true` exige un projectId `demo-` y conecta a Auth local 9199, Firestore local 8180 y Functions local 5001 en `europe-west1`. Functions usa Node.js 22, sin instancias mínimas y con máximo 10 instancias por función. El build de pruebas fuerza valores demo; los scripts de deploy rechazan esos valores.

## Documentos

```text
users/{uid}                            Cuenta, plan y contador acumulado
├── budgets/{id}                       Partidas y tareas embebidas
├── tariffCatalogs/main-v1             Catálogo único: partidas con conceptos embebidos
├── templates/{id}                     Partidas, catálogo, ajuste e IVA
├── profile/data                      Datos de empresa y logo PNG como data URL
├── quoteEstimator/settings           Configuración privada del estimador público
├── leads/{leadId}                     Solicitudes privadas; titular puede listar/leer/borrar
└── settings/tariffCatalog             Referencia compatible al catálogo único
sharedBudgets/{token}                  DTO público v2 con propietario y caducidad
publicQuoteTokens/{token}              Índice token → UID, sólo servidor
quoteEstimatorLinks/{uid}              Token activo del propietario, sólo servidor
quoteEstimateRateLimits/{token}        Ventana de frecuencia, sólo servidor
quoteLeadRateLimits/{token}            Límite de envíos de leads, sólo servidor
```

Los IDs son UUID y las fechas de documentos son ISO strings. El vencimiento premium añade milisegundos para las reglas; el vencimiento público es numérico.

## Autorización y cuota

Las reglas separan la raíz de cuenta de las colecciones editables; no usan un permiso recursivo que pueda reabrir la raíz. Los clientes nuevos solo pueden crear una cuenta free, no-admin y con contador cero. No pueden asignarse un rol, plan o vencimiento. El admin existente está restringido a la identidad designada y al flag protegido. La provisión de roles nuevos requiere una operación de confianza.

La creación de un presupuesto se ejecuta junto al incremento del contador y el último ID creado en una transacción. Las reglas exigen esa relación y aplican la cuota free o el premium vigente usando request.time. Borrar un presupuesto no devuelve cuota. Actualizar un documento existente no consume otra creación.

Los snapshots públicos permiten get individual, deniegan list y exigen propietario autenticado al crear. Caducan, son inmutables y su propietario puede revocarlos. El DTO elimina costes internos y metadatos privados antes de escribirlo. Los enlaces legacy no seguros quedan bloqueados; revisar la transición en stability-and-release.md.

El propietario lee y escribe `users/{uid}/quoteEstimator/settings`; la colección raíz `quoteEstimator` queda fuera de las reglas genéricas. El esquema 2 guarda tarifas manuales por estancia en céntimos por m²; el esquema 1 conserva combinaciones vinculadas al catálogo y sigue siendo compatible. Las selecciones nuevas llevan un `instanceId` UUID único para identificar cada estancia física, con su superficie y calidad. `quantity` (entero de 1 a 20) se mantiene para datos agrupados históricos; si falta, se interpreta como una estancia. El perfil conserva una URL HTTPS de privacidad. Las reglas permiten al titular leer/listar y borrar `users/{uid}/leads`, deniegan su creación desde cliente y restringen su única edición a `budgetId` hacia un presupuesto de la misma cuenta. La creación del lead solo ocurre en `submitPublicLead`, con Admin SDK. Las reglas deniegan clientes para el índice `publicQuoteTokens`, el enlace por UID y los contadores. `publishPublicEstimator`, `revokePublicEstimator` y `getOwnerEstimatorStatus` requieren Auth. `getPublicEstimator`, `calculatePublicEstimate` y `submitPublicLead` son públicos y reciben el token aleatorio de 24 bytes codificado base64url; el token localiza al usuario en Functions, nunca habilita una lectura Firestore del visitante. `getPublicEstimator` devuelve nombre de empresa, contactos optativos y combinaciones disponibles; el cálculo y el envío solo devuelven horquilla total, moneda, IVA y confirmación. No se devuelven UID, contacto del lead, catálogo, descripciones internas, precios unitarios ni `cost`.

El límite por token válido de estimación es de 20 llamadas por minuto, compartido por resolución del formulario y cálculo. El envío de leads tiene un límite separado de 10 por token en una hora. Las peticiones con tokens inválidos aún invocan la función y hacen una lectura del índice antes de rechazarse; estos límites por token no protegen frente a ráfagas globales ni fijan un máximo de coste. El despliegue requiere valorar controles globales y alertas de presupuesto. Solo se persiste el contador de ventana en los documentos de límites; no se guarda IP. El lead conserva contacto, selecciones, plazo de inicio elegido, horquilla, fechas de consentimiento y URL de privacidad hasta que el titular lo borre manualmente; no hay TTL. El plazo es una de cuatro opciones generales y no implica duración ni compromiso de fecha. El nombre de empresa se muestra; teléfono y correo solo se incluyen si el propietario lo habilita. La horquilla puede permitir inferir parcialmente precios subyacentes al comparar muchas combinaciones, aunque el endpoint no los exponga directamente.

## Migraciones

Se siguen leyendo nombres antiguos de partidas/tareas. El perfil antiguo en settings/profile se traslada a profile/data. Las tarifas antiguas se agrupan en un catálogo determinista legacy-v1. Las cuentas legacy no se promocionan a roles de confianza desde un documento editable: requieren revisión administrativa. Las operaciones de migración no se deben interpretar como una migración global transaccional del proyecto.

## Pruebas y publicación

`pnpm test:integration` construye Functions y ejecuta reglas y navegador sobre emuladores de Auth, Firestore y Functions. `pnpm firebase:deploy` publica solo Hosting; `pnpm firebase:deploy:all` publica reglas y Hosting, pero no incluye Functions. Para desplegar Functions se usa Firebase CLI con `--only functions`. El build remoto usa pnpm y requiere `functions/pnpm-workspace.yaml` con aprobación explícita de los scripts de `@firebase/util` y `protobufjs`, además de `@google-cloud/functions-framework` como dependencia directa.

BG-005 se desplegó el 18-10-2026 al proyecto `budgenerator`: Hosting en https://budgenerator.web.app; seis Cloud Functions v2 ACTIVE en `europe-west1` con runtime Node.js 22; y las reglas de Firestore. Se configuró limpieza automática de imágenes de Functions tras 1 día. Firestore Standard está en `europe-southwest1`; no se escribieron ni migraron datos durante el despliegue. La región de Functions es independiente de la base Firestore. CI no despliega. La cuenta admin de la aplicación no autentica al CLI.

La simplificación del configurador BG-005 se publicó el 18-10-2026 con `--only functions,hosting`: las seis Functions siguen ACTIVE y Hosting responde HTTP 200. Las reglas y los documentos existentes no se modificaron en esta actualización.

El refinamiento por instancia física, gestión del enlace y navegación de BG-005 se desplegó el 18-10-2026 con `--only functions,hosting`. Hosting responde HTTP 200 y publica PWA `c5e5f82bd46dd887`; las seis Functions están ACTIVE en `europe-west1` con Node.js 22. No se desplegaron reglas ni se modificaron documentos de Firestore.

El ajuste de navegación del 18-10-2026 se desplegó solo a Hosting: Estimador se movió del menú principal al menú del header y se ordenaron sus opciones. Hosting responde HTTP 200 y publica PWA `47e844d6b2b97b27`. No hubo cambios de Functions, reglas ni documentos de Firestore.

El 18-10-2026 se corrigió el 403 de los callables del estimador estableciendo `roles/run.invoker` para `allUsers` en los seis servicios Cloud Run. La publicación de Functions por sí sola no actualizó esta política IAM en los callables existentes. Esto habilita llegar a la capa callable; `publishPublicEstimator`, `revokePublicEstimator` y `getOwnerEstimatorStatus` exigen autenticación Firebase en su handler, y los callables públicos validan token aleatorio y límites por token antes de leer o guardar datos. La comprobación sin sesión pasa de 403 en Cloud Run a 401 `UNAUTHENTICATED` generado por el handler. No se modificaron reglas ni documentos de Firestore.

BG-008: inicialización idempotente en transacción sobre `tariffCatalogs/main-v1` y `settings/tariffCatalog`. Datos actuales de prueba: se copia el catálogo activo antes de borrar sobrantes; las tarifas legacy tienen prioridad sobre la base inicial si no existe catálogo. Un fallo de creación no borra fuentes; un fallo de limpieza admite reintento y conserva el destino. No cambian las reglas ni los permisos. La unicidad es un contrato de la aplicación; clientes antiguos aún pueden escribir otros IDs bajo las reglas actuales. No se ejecuta un borrado global ni una migración remota mediante scripts.

La extensión de BG-008 persiste `parts[]`, con conceptos anidados y sin categoría redundante. El adaptador agrupa catálogos planos antiguos por `Tariff.category` y asigna IDs deterministas; la escritura canónica ocurre durante la carga idempotente del catálogo. Los presupuestos y plantillas mantienen sus snapshots históricos: sólo las nuevas selecciones guardan `catalogPartId` y `catalogConceptId` opcionales. Esos IDs son privados y se omiten de los DTO públicos.

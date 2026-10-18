# Arquitectura actual

Actualizado el 18 de octubre de 2026 para budgenerator.

## Capas

`app → pages → features → entities → shared`. Las páginas son entradas por ruta; `features/budget-editor` contiene el editor compartido por presupuesto y plantilla. Los adaptadores de Firebase viven dentro de su entidad. `shared` no importa entidades.

## Arranque y sesión

`main.tsx` monta React sin esperar traducciones por red. `App` mantiene una única suscripción de autenticación. El coordinador `app/session.ts` asigna el UID, reinicia los stores al cambiar de cuenta y carga las entidades. Los guards no crean listeners ni recargan listas durante la navegación. Una página privada se monta cuando la sesión está lista; los fallos de carga tienen un límite de tiempo y un botón para reintentar.

Los loaders capturan una revisión de sesión y descartan respuestas de una cuenta anterior. Los módulos compartidos `shared/model/session.ts` y `shared/model/sync.ts` no dependen de entidades. El auth store vacía escrituras pendientes antes de cerrar sesión.

## Rutas

Públicas: `/login`, `/shared/:token` y `/solicitar-presupuesto/:token`. Privadas: `/projects`, `/projects/:projectId`, `/budgets`, `/budget/:budgetId`, `/catalog` (con redirecciones desde `/catalogs` y `/catalogs/:catalogId`), `/templates`, `/templates/:templateId`, `/profile`, `/estimator` (con redirección desde `/profile/estimador-publico`), `/profile/solicitudes`, `/account`, `/account/password` y `/help`. `/catalog` abre directamente el catálogo único de la cuenta. `new` identifica un borrador de presupuesto o plantilla. `/admin` requiere el rol existente y protegido. `/` redirige a `/projects`, la entrada operativa principal.

Las páginas se cargan con `lazy`. Un fallback visible evita pantallas vacías durante la resolución inicial. AppShell conserva navegación, estado de guardado y acceso a cuenta. El permiso real lo decide Firestore.

## Presupuestos y plantillas

El store de budget gestiona un documento activo o un draft. Las recargas de lista no eliminan el draft. Este se recuerda temporalmente por UID en sessionStorage; las plantillas tienen su propia clave. Los componentes de edición son comunes y el IVA se conserva al guardar y reutilizar una plantilla.

La creación usa un ID idempotente y una transacción de presupuesto y contador. Las modificaciones usan una cola por documento y updateDoc. El borrado cancela la cola y espera una escritura en curso antes de eliminar.

Los cálculos residen en `shared/lib/budgetMath.ts`. El DTO de publicación se construye mediante una lista explícita de campos. El PDF comparte la política de cálculo y acepta tanto documentos privados como públicos.

## PWA

`scripts/build-sw.mjs` genera el worker a partir del build y del código del worker. Se precachean recursos estáticos, nunca documentos Firebase. La actualización espera al usuario y al guardado de cambios. Ver la guía de estabilización para el alcance offline y la recuperación.

## Componentes UX (BG-007)

`shared/ui` proporciona PageHeader/BackButton, CompanyAvatar, InfoPopover y SwipeActions, sin importar entidades. Cada página mantiene las acciones de negocio y el único estado de reveal de su lista; los borrados/selección siguen las APIs públicas de stores existentes. `/help` se carga con lazy y conserva contenido local en `pages/help/helpContent.ts`. La entrega de BG-007 no incorpora el prototipo local de BG-006 ni activa IA.

## BG-008 — catálogo y estructura guiada

`entities/catalog` inicializa `tariffCatalogs/main-v1` en transacción. La forma persistida es `parts[]`, cada partida con ID, nombre y conceptos embebidos; `tariffs` es una proyección plana de cliente para componentes existentes. Los catálogos planos antiguos se agrupan por categoría con IDs deterministas. Primero conserva el catálogo activo válido (o el primero por ID), después retira los catálogos anteriores de prueba. Si ya existe el destino, la transacción lo conserva: otra pestaña no reemplaza su contenido. Las referencias históricas `catalogId` en presupuestos/plantillas se mantienen por compatibilidad; las nuevas selecciones vienen del catálogo único. `TRADE_CATALOGS` ofrece las bases especializadas del proyecto. El modal agrupa conceptos por partida y `importTrade` acepta categoría completa, partida o concepto; fusiona por nombre normalizado y omite conceptos ya presentes (descripción y unidad), sin sustituir precios personalizados. Sólo persiste una actualización por importación mediante la cola del store.

`features/app-tour` acompaña el alta correcta con un recorrido opcional de cinco rutas reales que comienza en Proyectos y explica cómo convertir desde Presupuestos. `AppTourProvider` vive en la shell autenticada; el UID pendiente se marca temporalmente en `sessionStorage` y la finalización se recuerda por UID en `localStorage`. El tour se puede repetir desde Ayuda y no añade lecturas ni escrituras a Firebase.

## BG-005 — estimador público

`entities/quote-estimator` contiene contratos versionados de configuración, solicitud y lead, además del cálculo puro compartido con Functions. El esquema 2 guarda por estancia un precio mínimo/máximo por m² para calidad media y un incremento en céntimos que deriva alta y lujo. En el formulario, cada estancia física tiene un `instanceId` UUID y sus propios m² y calidad; cada tipo admite hasta 20 estancias, y una integral suma las seleccionadas. El campo heredado `quantity` sigue admitido sin `instanceId` para leads y solicitudes anteriores. El esquema 2 multiplica superficie × tarifa por instancia; el esquema 1 conserva el cálculo de catálogo y la compatibilidad con cantidad agrupada. La configuración autenticada vive en `/estimator`, accesible desde el menú desplegable del header; `/profile/estimador-publico` redirige por compatibilidad. Su resumen mantiene accesibles URL, abrir, copiar, revocar y borrar configuración, y al borrar revoca el token sin eliminar leads. La captura incluye nombre, email, teléfono, consentimiento y uno de cuatro plazos generales de inicio. La ruta pública obtiene opciones generales y envía el formulario a Cloud Functions; nunca descarga conceptos ni precios unitarios. Functions resuelve el token revocable, lee el catálogo actual solo para esquema 1, valida el plazo, recalcula y guarda el lead con idempotencia; solo devuelve la horquilla y confirmación, sin datos de contacto, UID o catálogo. `pages/leads` lista los leads del titular y permite borrado manual o iniciar un borrador de presupuesto. La conversión enlaza lead y presupuesto dentro de la transacción que actualiza la cuota; muestra el contexto original, incluido el plazo, en modo de solo lectura y no copia esos datos al presupuesto. Solicitudes ocupa la última posición de navegación y Mi empresa se abre desde el menú superior.

`features/budget-structure` ofrece una selección opcional en pasos dinámicos para presupuestos nuevos: selección de partidas, un paso por cada partida y revisión. Cada paso muestra todos los conceptos de esa partida, con búsqueda local y cantidad opcional; la selección y sus cantidades sobreviven a la navegación entre pasos. `appendStructure(items, expected)` incorpora una selección atómica con IDs nuevos y conserva los IDs de catálogo como metadatos privados opcionales. La feature comprueba también sesión y referencia del catálogo. Las cantidades vacías son cero (incompletas); se guardan como borrador y la validación habitual bloquea exportación/publicación si falta completarlas.

`app/pwaInstall.ts` captura el evento de instalación antes del render y expone un controlador observable. El banner sólo vive en la shell privada, se oculta en standalone o al instalar y recuerda el descarte durante la sesión. Las instrucciones manuales no garantizan disponibilidad de instalación. No se altera el flujo de actualización del service worker.

## BG-009 — proyectos

`entities/project` crea una copia inmutable del presupuesto aceptado y mantiene las partidas como documentos de subcolección. El store conserva resúmenes y un detalle activo; `/projects` consulta sólo los primeros y carga las subcolecciones al entrar al detalle. Los suplementos económicos y sus anulaciones justificadas son registros append-only en subcolecciones propias. La ampliación actualiza importes y trabajo activo en una transacción sin alterar el presupuesto aceptado ni su total original.

La conversión es explícita e idempotente. Un presupuesto aceptado queda bloqueado; retirar la aceptación lo desbloquea mientras no esté convertido. El presupuesto convertido queda como origen de solo lectura y se puede duplicar con IDs nuevos para preparar otra oferta. El estado deriva de los conceptos terminados; el progreso pondera los importes netos previstos y usa cantidad de conceptos cuando no se pueden ponderar todas las líneas. Cada concepto completado guarda una fecha local editable (`YYYY-MM-DD`); la gráfica acumula el progreso por fecha y ofrece tabla accesible, sin cambiar el avance actual al corregir una fecha. El límite Free es de tres plazas compartidas: convertir conserva la plaza del presupuesto origen.

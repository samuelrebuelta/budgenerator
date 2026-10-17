# Arquitectura actual

Actualizado el 17 de octubre de 2026 para budgenerator.

## Capas

`app → pages → features → entities → shared`. Las páginas son entradas por ruta; `features/budget-editor` contiene el editor compartido por presupuesto y plantilla. Los adaptadores de Firebase viven dentro de su entidad. `shared` no importa entidades.

## Arranque y sesión

`main.tsx` monta React sin esperar traducciones por red. `App` mantiene una única suscripción de autenticación. El coordinador `app/session.ts` asigna el UID, reinicia los stores al cambiar de cuenta y carga las entidades. Los guards no crean listeners ni recargan listas durante la navegación. Una página privada se monta cuando la sesión está lista; los fallos de carga tienen un límite de tiempo y un botón para reintentar.

Los loaders capturan una revisión de sesión y descartan respuestas de una cuenta anterior. Los módulos compartidos `shared/model/session.ts` y `shared/model/sync.ts` no dependen de entidades. El auth store vacía escrituras pendientes antes de cerrar sesión.

## Rutas

Públicas: `/login` y `/shared/:token`. Privadas: `/budgets`, `/budget/:budgetId`, `/catalog` (con redirecciones desde `/catalogs` y `/catalogs/:catalogId`), `/templates`, `/templates/:templateId`, `/profile`, `/account`, `/account/password` y `/help`. `/catalog` abre directamente el catálogo único de la cuenta. `new` identifica un borrador de presupuesto o plantilla. `/admin` requiere el rol existente y protegido. `/` redirige a `/budgets`.

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

`features/app-tour` acompaña el alta correcta con un recorrido opcional de cuatro rutas reales. `AppTourProvider` vive en la shell autenticada; el UID pendiente se marca temporalmente en `sessionStorage` y la finalización se recuerda por UID en `localStorage`. El tour se puede repetir desde Ayuda y no añade lecturas ni escrituras a Firebase.

`features/budget-structure` ofrece una selección opcional en pasos dinámicos para presupuestos nuevos: selección de partidas, un paso por cada partida y revisión. Cada paso muestra todos los conceptos de esa partida, con búsqueda local y cantidad opcional; la selección y sus cantidades sobreviven a la navegación entre pasos. `appendStructure(items, expected)` incorpora una selección atómica con IDs nuevos y conserva los IDs de catálogo como metadatos privados opcionales. La feature comprueba también sesión y referencia del catálogo. Las cantidades vacías son cero (incompletas); se guardan como borrador y la validación habitual bloquea exportación/publicación si falta completarlas.

`app/pwaInstall.ts` captura el evento de instalación antes del render y expone un controlador observable. El banner sólo vive en la shell privada, se oculta en standalone o al instalar y recuerda el descarte durante la sesión. Las instrucciones manuales no garantizan disponibilidad de instalación. No se altera el flujo de actualización del service worker.

# Arquitectura actual

Actualizado el 14 de octubre de 2026 para budgenerator.

## Capas

`app → pages → features → entities → shared`. Las páginas son entradas por ruta; `features/budget-editor` contiene el editor compartido por presupuesto y plantilla. Los adaptadores de Firebase viven dentro de su entidad. `shared` no importa entidades.

## Arranque y sesión

`main.tsx` monta React sin esperar traducciones por red. `App` mantiene una única suscripción de autenticación. El coordinador `app/session.ts` asigna el UID, reinicia los stores al cambiar de cuenta y carga las entidades. Los guards no crean listeners ni recargan listas durante la navegación. Una página privada se monta cuando la sesión está lista; los fallos de carga tienen un límite de tiempo y un botón para reintentar.

Los loaders capturan una revisión de sesión y descartan respuestas de una cuenta anterior. Los módulos compartidos `shared/model/session.ts` y `shared/model/sync.ts` no dependen de entidades. El auth store vacía escrituras pendientes antes de cerrar sesión.

## Rutas

Públicas: `/login` y `/shared/:token`. Privadas: `/budgets`, `/budget/:budgetId`, `/catalogs`, `/catalogs/:catalogId`, `/templates`, `/templates/:templateId`, `/profile`, `/account` y `/account/password`. `/catalogs` muestra la biblioteca y cada `:catalogId` abre su editor. `new` identifica un borrador de presupuesto o plantilla. `/admin` requiere el rol existente y protegido. `/` redirige a `/budgets`.

Las páginas se cargan con `lazy`. Un fallback visible evita pantallas vacías durante la resolución inicial. AppShell conserva navegación, estado de guardado y acceso a cuenta. El permiso real lo decide Firestore.

## Presupuestos y plantillas

El store de budget gestiona un documento activo o un draft. Las recargas de lista no eliminan el draft. Este se recuerda temporalmente por UID en sessionStorage; las plantillas tienen su propia clave. Los componentes de edición son comunes y el IVA se conserva al guardar y reutilizar una plantilla.

La creación usa un ID idempotente y una transacción de presupuesto y contador. Las modificaciones usan una cola por documento y updateDoc. El borrado cancela la cola y espera una escritura en curso antes de eliminar.

Los cálculos residen en `shared/lib/budgetMath.ts`. El DTO de publicación se construye mediante una lista explícita de campos. El PDF comparte la política de cálculo y acepta tanto documentos privados como públicos.

## PWA

`scripts/build-sw.mjs` genera el worker a partir del build y del código del worker. Se precachean recursos estáticos, nunca documentos Firebase. La actualización espera al usuario y al guardado de cambios. Ver la guía de estabilización para el alcance offline y la recuperación.

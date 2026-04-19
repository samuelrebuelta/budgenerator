# Arquitectura del proyecto

## Feature-Sliced Design (FSD)

El proyecto sigue una versión adaptada de [Feature-Sliced Design](https://feature-sliced.design), una metodología de organización de código frontend que divide la aplicación en capas con responsabilidades claras.

### Capas

```
src/
├── app/          → Shell de la aplicación (bootstrap, routing, guards)
├── entities/     → Dominio de negocio (stores, modelos)
├── pages/        → Vistas completas (una por ruta)
└── shared/       → Código reutilizable sin dependencia de dominio
```

### Regla de dependencias

Las capas solo pueden importar de capas inferiores:

```
pages → entities → shared
app → pages, entities, shared
```

**Prohibido**: `shared` nunca importa de `entities` o `pages`. `entities` nunca importa de `pages`.

## Capa `app/`

Contiene el bootstrap de la aplicación:

| Archivo | Responsabilidad |
|---|---|
| `App.tsx` | Monta el `RouterProvider` |
| `router.tsx` | Define todas las rutas con `createBrowserRouter` |
| `AuthGuard.tsx` | Componente wrapper que protege rutas, inicializa auth, y carga datos |

### AuthGuard

Es el punto de entrada para la sesión del usuario. Al detectar un `user` autenticado:

1. Inyecta el UID en los stores via `setXxxAuthGetter()` (patrón de inyección para evitar dependencias circulares)
2. Dispara `loadBudgets()`, `loadTariffs()`, `loadProfile()` en paralelo
3. Muestra "Cargando..." mientras `loading === true`
4. Redirige a `/login` si no hay usuario

## Capa `entities/`

Cada entidad tiene su propia carpeta con:

```
entities/
└── budget/
    ├── index.ts        → Barrel export (API pública)
    └── model/
        └── store.ts    → Zustand store con estado + acciones
```

### Entidades

| Entidad | Responsabilidad |
|---|---|
| `auth` | Estado de autenticación (user, loading, error). Wrapper de Firebase Auth. |
| `budget` | Estado completo de presupuestos: lista, borrador, presupuesto activo. CRUD + cálculos (subtotales, IVA, total, margen). |
| `tariff` | Catálogo de tarifas con CRUD. Seed de defaults. Cache con flag `loaded`. |
| `profile` | Perfil de empresa. Logo almacenado como base64. CRUD simple. |

### Patrón de inyección de auth

Los stores de `budget`, `tariff` y `profile` necesitan el UID del usuario para las operaciones de Firestore. Para evitar dependencias circulares con `auth`, se usa un patrón de inyección:

```typescript
// En cada entity store:
let _getUid: (() => string | null) | null = null;
export function setBudgetAuthGetter(fn: () => string | null) {
  _getUid = fn;
}

// En AuthGuard, al detectar usuario:
setBudgetAuthGetter(() => user.uid);
```

## Capa `pages/`

Cada página corresponde a una ruta:

| Ruta | Página | Descripción |
|---|---|---|
| `/login` | `LoginPage` | Login + registro con email/password |
| `/` | `BudgetListPage` | Lista de presupuestos del usuario |
| `/budget/:budgetId` | `BudgetPage` | Editor de presupuesto (o borrador si `budgetId === 'new'`) |
| `/catalog` | `CatalogPage` | Gestión del catálogo de tarifas |
| `/profile` | `ProfilePage` | Datos de empresa y logo |

### Componentes de página

Las páginas complejas (como `BudgetPage`) dividen su UI en componentes internos dentro de `components/`:

```
pages/budget/
├── BudgetPage.tsx
├── index.ts
└── components/
    ├── BudgetHeader.tsx      → Info cliente + datos empresa (print)
    ├── BudgetEditor.tsx      → Tabla/cards de partidas y conceptos (usa EditableRow)
    ├── BudgetSummary.tsx     → Subtotales, IVA, total, descuentos/recargos
    ├── AddWorkItemButton.tsx → Selector de categoría para nueva partida
    ├── AddTaskButton.tsx     → Botón para añadir fila (deshabilitado si hay borrador)
    ├── TariffSelector.tsx    → Dropdown para aplicar tarifa a una fila
    └── ExportPdfButton.tsx   → Botón de impresión/exportación PDF
```

## Capa `shared/`

Código sin dependencia de dominio:

| Módulo | Contenido |
|---|---|
| `firebase/` | Configuración Firebase, funciones CRUD de Firestore, auth helpers |
| `i18n/` | Traducciones (`es.ts`) y export `t` para acceso directo a claves |
| `types/` | Interfaces TypeScript (`Budget`, `Tariff`, `CompanyProfile`, etc.) |
| `lib/` | Utilidades: `cn()` (clsx+twMerge), `formatCurrency()`, `generateId()` |
| `ui/` | Componentes UI genéricos: `Button`, `Input`, `Select`, `Modal`, `EditableRow` |

## Flujo de datos

```
Usuario → Componente React → Zustand Store → (debounce 1s) → Firestore
                                  ↑
                                  │
Firebase Auth ─→ AuthGuard ─→ loadData() ─→ Firestore → Store → React
```

1. El usuario interactúa con la UI
2. El componente llama a una acción del store Zustand
3. Zustand actualiza el estado inmediatamente (optimista)
4. El store programa un `syncToFirestore` con debounce de 1 segundo
5. Firestore persiste los datos en la nube

Al cargar la app:
1. Firebase Auth detecta la sesión
2. AuthGuard carga datos de Firestore a los stores
3. React se re-renderiza con los datos frescos

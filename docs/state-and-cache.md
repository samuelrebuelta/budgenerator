# Estado y caché

## Zustand como gestor de estado

La aplicación usa [Zustand](https://zustand-demo.pmnd.rs/) v5 para la gestión de estado global. Se eligió por su simplicidad, rendimiento y compatibilidad con React 19.

### Stores

Hay 4 stores independientes:

| Store | Archivo | Estado principal |
|---|---|---|
| `useAuthStore` | `entities/auth/model/store.ts` | `user`, `loading`, `error` |
| `useBudgetStore` | `entities/budget/model/store.ts` | `budgets[]`, `activeBudgetId`, `draftBudget`, `loaded` |
| `useTariffStore` | `entities/tariff/model/store.ts` | `tariffs[]`, `loaded` |
| `useProfileStore` | `entities/profile/model/store.ts` | `profile`, `loaded` |

### Por qué no se usa persist middleware

Los stores **no** usan el middleware `persist` de Zustand. En lugar de localStorage, los datos se sincronizan directamente con Firestore. Esto garantiza:

- Los datos siempre están actualizados entre dispositivos
- No hay conflictos entre caché local y datos remotos
- El usuario puede usar la app desde cualquier navegador sin pérdida de datos

## Estrategia de caché

### Flag `loaded`

Los stores de `budget`, `tariff` y `profile` mantienen un flag `loaded: boolean` que indica si los datos ya se han cargado de Firestore en la sesión actual.

```typescript
// En tariff store
loadTariffs: async (uid) => {
  if (get().loaded) return;  // ← Cache hit: no re-fetch
  const tariffs = await fetchTariffs(uid);
  // ...
  set({ tariffs, loaded: true });
},
```

**Comportamiento**:
- `loaded = false`: Los datos no se han cargado aún (estado inicial o después de logout)
- `loaded = true`: Los datos ya se cargaron → las llamadas posteriores a `loadXxx()` son no-ops

Esto evita re-fetches innecesarios cuando React re-renderiza `AuthGuard` o cuando el usuario navega entre páginas.

### Caché de tarifas

El store de tarifas tiene una optimización adicional: si los datos ya están cargados (`loaded === true`), `loadTariffs()` retorna inmediatamente sin hacer petición a Firestore. Esto es especialmente útil porque:

- Las tarifas rara vez cambian durante una sesión
- Son el dataset más grande (~250 documentos)
- Se leen frecuentemente (cada vez que se abre el TariffSelector)

### Sin caché en budgets

El store de budgets **siempre** recarga al inicio de sesión (no tiene la guarda `if (get().loaded) return`) porque:

- Los presupuestos son el dato principal y más sensible
- Se modifican frecuentemente
- Es preferible mostrar datos frescos a arriesgar inconsistencias

Sin embargo, sí preserva el `activeBudgetId` entre recargas:

```typescript
loadBudgets: async (uid) => {
  const budgets = await fetchBudgets(uid);
  const currentActive = get().activeBudgetId;
  const stillExists = budgets.some((b) => b.id === currentActive);
  set({
    budgets,
    activeBudgetId: stillExists ? currentActive : null,  // ← Preserva selección
    loaded: true,
  });
},
```

## Sincronización con Firestore

### Escritura debounced (budget store)

Cada mutación del presupuesto activo se persiste a Firestore con un debounce de 1 segundo:

```typescript
function syncToFirestore(budget: Budget) {
  const uid = getUid();
  if (!uid || !budget.id) return;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    const cleaned: Budget = {
      ...budget,
      sections: budget.sections.map((s) => ({
        ...s,
        rows: s.rows.filter(isRowComplete),
      })),
    };
    saveBudget(uid, cleaned);
    _syncTimer = null;
  }, 1000);
}
```

**Motivación**: Sin debounce, cada keystroke en un input generaría una escritura a Firestore. Con debounce de 1s, se agrupan las ediciones rápidas en una sola escritura.

**Filtrado de filas incompletas**: Antes de persistir, se filtran las filas que no tienen todos los campos rellenos (descripción, cantidad > 0, precio > 0). Las filas incompletas se mantienen en el estado local para que el usuario las edite, pero no se guardan en Firestore.

**Excepción**: Los borradores (`draftBudget`) NO se sincronizan. Solo se persisten al llamar a `saveDraft()`.

### Escritura inmediata (tariff y profile stores)

Las tarifas y el perfil se persisten inmediatamente al editar, sin debounce:

```typescript
// tariff store
updateTariff: async (id, updates) => {
  const uid = getUid();
  if (uid) await updateTariffDoc(uid, id, updates);  // ← Inmediato
  set((state) => ({ tariffs: state.tariffs.map(/* ... */) }));
},
```

Esto es aceptable porque las ediciones de tarifas/perfil son menos frecuentes que las de presupuestos.

## Patrón Draft/Active

El budget store gestiona dos modos:

### Presupuesto activo (persisted)

```
budgets[]: Budget[]  ←  Lista completa de Firestore
activeBudgetId: string | null  ←  ID del presupuesto siendo editado
```

Las mutaciones (`updateRow`, `addSection`, etc.) operan sobre el presupuesto dentro del array `budgets[]` y disparan `syncToFirestore()`.

### Borrador (draft)

```
draftBudget: Budget | null  ←  Presupuesto temporal no persistido
```

Las mismas mutaciones operan sobre `draftBudget` en lugar del array. No se sincronizan. El borrador se convierte en presupuesto real al llamar a `saveDraft()`, que:

1. Genera un ID con `crypto.randomUUID()`
2. Añade `createdAt` timestamp
3. Persiste a Firestore
4. Mueve el presupuesto de `draftBudget` a `budgets[]`

### Transparencia con `getActive()` y `updateActive()`

Helpers internos que abstraen si estamos operando en draft o activo:

```typescript
function getActive(state: StateSlice): Budget | undefined {
  return state.draftBudget ?? state.budgets.find((b) => b.id === state.activeBudgetId);
}

function updateActive(state: StateSlice, updater: (b: Budget) => Budget) {
  if (state.draftBudget) {
    return { draftBudget: updater(state.draftBudget) };
  }
  return {
    budgets: state.budgets.map((b) =>
      b.id === state.activeBudgetId ? updater(b) : b,
    ),
  };
}
```

Esto permite que todas las acciones (addRow, updateInfo, etc.) funcionen igual para drafts y presupuestos persistidos, sin duplicar lógica.

## Selectores

### `useActiveBudget()`

Selector derivado que devuelve el presupuesto actualmente en edición:

```typescript
export function useActiveBudget() {
  return useBudgetStore((s) =>
    s.draftBudget ?? s.budgets.find((b) => b.id === s.activeBudgetId),
  );
}
```

Se usa en `BudgetPage`, `BudgetEditor`, `BudgetHeader`, `BudgetSummary` y `AddSectionButton`.

### Selectores de cálculo

Los cálculos (`getRawSubtotal`, `getSubtotal`, `getIva`, `getTotal`) son funciones del store que se invocan como selectores. No están memoizadas a nivel de Zustand pero son cálculos ligeros sobre arrays pequeños.

### Lógica de recargos y descuentos

El budget store distingue entre recargos (multiplicador > 1) y descuentos (multiplicador < 1):

- **Recargo**: El multiplicador se aplica en `getRowAmount()` y `getSectionSubtotal()`. Las filas y subtotales de partida ya incluyen el recargo. El sumario no muestra línea separada en el PDF.
- **Descuento**: Las filas mantienen el precio original. `getSubtotal()` aplica el multiplicador globalmente. El sumario muestra la línea de descuento visible en el PDF.

```typescript
getRowAmount: (row) => {
  const mult = budget?.adjustment?.multiplier ?? 1;
  return getRowAmountRaw(row) * (mult > 1 ? mult : 1);
},
```

### Guard de filas en borrador

El botón `AddRowButton` se deshabilita si ya existe una fila en borrador (sin descripción, cantidad 0, precio 0) en la partida. Esto evita acumular filas vacías.

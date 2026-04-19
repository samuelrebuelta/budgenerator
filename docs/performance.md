# Rendimiento

## Estrategia general

La aplicación prioriza la percepción de velocidad del usuario:

1. **Actualización optimista**: Los cambios se reflejan inmediatamente en la UI antes de persistir en Firestore.
2. **Debounce en escrituras**: Las escrituras a Firestore se agrupan con un delay de 1 segundo.
3. **Memoización de componentes**: Los componentes pesados están envueltos en `React.memo`.
4. **Caché de datos**: Los datasets grandes (tarifas) se cachean con un flag `loaded`.

## Memoización de componentes

### Conceptos del presupuesto

Los conceptos son los componentes más repetidos y re-renderizados. Están envueltas en `React.memo` via el componente `BudgetTaskItem`:

```typescript
const BudgetTaskItem = memo(function BudgetTaskItem({ workItemId, task, workItemName }: Props) {
  // Suscripción al multiplicador de ajuste para forzar re-render al cambiar recargo
  const _mult = useBudgetStore((s) => {
    const b = s.draftBudget ?? s.budgets.find((b) => b.id === s.activeBudgetId);
    return b?.adjustment?.multiplier ?? 1;
  });
  void _mult;
  // Solo se re-renderiza si workItemId, row, workItemName o multiplier cambian
});
```

**Impacto**: Sin memo, editar un concepto re-renderizaría todos los conceptos de todas las secciones. Con memo, solo se re-renderiza el concepto editado. La suscripción explícita al `multiplier` asegura que al añadir/quitar un recargo, todas las filas se actualizan.

### TariffSelector

El selector de tarifas agrupa y ordena las tarifas cada vez que se renderiza. Está envuelto en `React.memo` y usa `useMemo` internamente:

```typescript
export const TariffSelector = memo(function TariffSelector({ workItemId, taskId, workItemName }) {
  const { matched, grouped } = useMemo(() => {
    // Agrupación y ordenación de tarifas por categoría
    // Optimización: si el nombre de la sección coincide con una categoría,
    // solo muestra esa categoría (menos opciones → render más rápido)
  }, [tariffs, workItemName]);
});
```

**Optimización del matched**: Si la partida se llama "Electricidad", el TariffSelector solo muestra tarifas de la categoría "Electricidad" en lugar de las 250+. Esto reduce significativamente el número de `<option>` renderizados.

## Debounce

### Escrituras a Firestore (1 segundo)

El budget store agrupa las escrituras con `setTimeout` de 1000ms:

```typescript
function syncToFirestore(budget: Budget) {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    saveBudget(uid, budget);
  }, 1000);
}
```

Sin esto, escribir "Casa de María" en el campo "Nombre del cliente" generaría ~14 escrituras. Con debounce, genera 1-2.

### Búsqueda en el catálogo (200ms)

El `CatalogPage` debouncea el filtro de búsqueda para evitar re-filtrar en cada keystroke:

```typescript
const [search, setSearch] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(search), 200);
  return () => clearTimeout(timer);
}, [search]);

// El filtrado usa debouncedSearch, no search
const grouped = useMemo(() => {
  const q = debouncedSearch.toLowerCase();
  // ...
}, [tariffs, debouncedSearch]);
```

## Caché de tarifas

El store de tarifas evita re-fetches con un flag `loaded`:

```typescript
loadTariffs: async (uid) => {
  if (get().loaded) return;  // Skip si ya cargadas
  // ...fetch from Firestore...
  set({ tariffs, loaded: true });
},
```

Las tarifas son el dataset más grande (~250 docs) y no cambian durante la edición de un presupuesto, así que cachearlas en memoria es seguro.

## Preservación del activeBudgetId

Al recargar la lista de presupuestos (por ejemplo, por un re-render de AuthGuard), el store preserva el presupuesto actualmente seleccionado si sigue existiendo:

```typescript
loadBudgets: async (uid) => {
  const budgets = await fetchBudgets(uid);
  const currentActive = get().activeBudgetId;
  const stillExists = budgets.some((b) => b.id === currentActive);
  set({
    budgets,
    activeBudgetId: stillExists ? currentActive : null,
  });
},
```

Esto evita que el usuario sea redirigido a la lista al editar un presupuesto si ocurre un re-mount.

## Optimizaciones de layout

### Componente unificado `EditableRow`

En lugar de renderizar dos layouts separados (tabla desktop + cards móvil), se usa un único componente `EditableRow` que muestra CSS Grid en desktop y cards en móvil. Ambos layouts viven en el mismo componente, controlados por `hidden sm:grid` y `sm:hidden`. Esto:

- Elimina la duplicación de código entre desktop y móvil
- Usa CSS Grid con `gridTemplateColumns` dinámico en vez de `<table>`
- Se reutiliza entre BudgetEditor y CatalogPage con columnas distintas

## Tamaño del bundle

El bundle actual (~747KB JS, ~227KB gzipped) incluye Firebase SDK que representa la mayor parte. Posibles optimizaciones futuras:

- Code-splitting con `React.lazy()` para páginas secundarias (catalog, profile)
- Tree-shaking más agresivo de Firebase (solo importar módulos usados)
- Separar el catálogo de tarifas default en un chunk lazy

## Assets estáticos

Firebase Hosting sirve los assets de `/assets/` con cabecera `Cache-Control: public, max-age=31536000, immutable` (1 año), configurado en `firebase.json`. Vite genera hashes en los nombres de archivo, así que la invalidación de caché es automática.

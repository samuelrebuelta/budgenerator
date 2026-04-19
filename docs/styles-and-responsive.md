# Estilos y responsive

## Tailwind CSS 4

El proyecto usa Tailwind CSS v4 con el plugin nativo de Vite (sin PostCSS):

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

La configuración se hace directamente en `src/index.css` con directivas `@import`, `@theme`, `@utility`, y `@custom-variant`.

### Tema de colores (`@theme`)

La paleta primaria azul se personaliza mediante la directiva `@theme` de Tailwind 4:

```css
@theme {
  --color-blue-50: #eef2f9;
  --color-blue-100: #d5deef;
  --color-blue-200: #aebfe0;
  --color-blue-300: #839dcf;
  --color-blue-400: #5e7fbf;
  --color-blue-500: #3d62ad;
  --color-blue-600: #2f4e9e;
  --color-blue-700: #263f80;
}
```

Todas las clases `bg-blue-600`, `text-blue-600`, `hover:bg-blue-700`, etc. usan automáticamente estos valores.

## Utilidades personalizadas

### scrollbar-none

Oculta la scrollbar manteniendo la funcionalidad de scroll:

```css
@utility scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

Se usa en las tablas del catálogo para permitir scroll horizontal sin barra visible.

### Variante print

Variante custom para estilos de impresión:

```css
@custom-variant print {
  @media print {
    @slot;
  }
}
```

Permite usar clases como `print:block`, `print:hidden`, `print:text-xs` para controlar la visibilidad en PDF.

### Collapsible

Animación de colapsar/expandir basada en `grid-template-rows` (anima `height: auto` sin JS):

```css
.collapsible {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms ease-out;
}
.collapsible.open {
  grid-template-rows: 1fr;
}
.collapsible > * {
  overflow: hidden;
}
```

Se usa en los toggles "Información del cliente", "Partidas" (BudgetPage), secciones de partidas (BudgetEditor) y categorías del catálogo (CatalogPage). El hijo directo debe ser un `<div>` wrapper. Para print se fuerza abierto con `print:grid-rows-[1fr]!`.

El estado abierto/cerrado de todos los colapsables se persiste en `localStorage` por ID de presupuesto:
- `collapsed-sections-{budgetId}` — partidas individuales
- `collapsed-partidas-{budgetId}` — toggle de secciones
- `collapsed-clientinfo-{budgetId}` — datos del cliente

## Composición de clases: cn()

Función helper que combina `clsx` (condicionales) con `tailwind-merge` (resolución de conflictos):

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Se usa en los componentes UI (`Button`, `Input`, `Select`) para permitir que los consumers sobreescriban clases:

```tsx
<Button className="w-full justify-center" />
// → merge de las clases base del Button con las del consumer
```

## Diseño responsive (mobile-first)

### Breakpoints

Se usa un único breakpoint `sm` (640px) como frontera entre móvil y escritorio:

| Dispositivo | Ancho | Layout |
|---|---|---|
| Móvil | < 640px | Cards, full-width, sin padding lateral |
| Desktop | ≥ 640px | Tablas, max-width containers, fondo gris |

### Patrones responsive

**Background condicional**: Blanco en móvil, gris en desktop:
```html
<div class="min-h-screen bg-white sm:bg-gray-100">
```

**Container con cards**: Full-width en móvil, card con borde en desktop:
```html
<div class="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 p-4 sm:p-8">
```

**Texto responsive**: Ocultar texto de botones en móvil, mostrar solo icono:
```html
<Button>
  <Plus size={16} />
  <span class="hidden sm:inline">Nuevo presupuesto</span>
</Button>
```

### Componente compartido `EditableRow`

En lugar de duplicar el layout dual (tabla desktop + cards móvil) en cada página, se usa un componente compartido `EditableRow` (`src/shared/ui/editable-row.tsx`) que renderiza automáticamente:

- **Desktop (≥ 640px)**: Concepto CSS Grid con columnas configurables
- **Móvil (< 640px)**: Card con descripción + acciones arriba, grid 3 columnas abajo, footer opcional
- **Print**: Fuerza el layout desktop

```tsx
import { EditableRow, EditableRowHeader } from '@/shared/ui/editable-row';

const COLUMNS: ColumnDef[] = [
  { key: 'description', label: 'Descripción', width: 'minmax(0,1fr)' },
  { key: 'quantity', label: 'Cantidad', width: '10%', align: 'right' },
  { key: 'unit', label: 'Unidad', width: '10%', align: 'center' },
  { key: 'price', label: 'Precio', width: '12%', align: 'right' },
  { key: 'amount', label: 'Importe', width: '12%', align: 'right', mobileHidden: true },
];

<EditableRowHeader columns={COLUMNS} />
<EditableRow
  columns={COLUMNS}
  cells={{
    description: { type: 'text', value: '...', onChange: ... },
    quantity: { type: 'number', value: 0, onChange: ... },
    unit: { type: 'unit-select', value: 'm2', onChange: ... },
    price: { type: 'number', value: 0, onChange: ... },
    amount: { type: 'display', content: <span>100€</span> },
  }}
  onDelete={...}
  headerExtra={<TariffSelector />}
  mobileFooter={{ label: 'Importe', value: <span>100€</span> }}
/>
```

Se usa en:
- **BudgetEditor**: Columnas de descripción, cantidad, unidad, precio, importe, margen
- **CatalogPage**: Columnas de descripción, unidad, coste, PVP, margen

Tipos de celda soportados:
- `text`: Input de texto
- `number`: Input numérico
- `unit-select`: Selector de unidades (`UNIT_LABELS`)
- `display`: Contenido React de solo lectura

## Touch targets

Todos los elementos interactivos tienen un tamaño mínimo de 44×44px (recomendación de accesibilidad WCAG):

```typescript
// Button
'min-h-[44px] py-2'

// Input
'min-h-[44px] py-2'
```

Los pills de categoría en `AddWorkItemButton` usan `px-3 py-2` para ser fáciles de pulsar en móvil.

## Iconos

Se usa [Lucide React](https://lucide.dev) para todos los iconos. Son SVGs tree-shakeable, cada icono se importa individualmente:

```typescript
import { Plus, Trash2, ArrowLeft, Save, X } from 'lucide-react';
```

Tamaños estándar:
- **14px**: Iconos en botones pequeños, acciones secundarias
- **16px**: Iconos en botones principales, acciones de concepto
- **20px**: Iconos decorativos (lista de presupuestos)
- **48px**: Iconos de estado vacío (empty state)

## Temas y colores

No hay sistema de temas/dark mode. Paleta primaria personalizada via `@theme`:

| Uso | Color |
|---|---|
| Primario (botones, links) | `blue-600` (`#2f4e9e`) / `blue-700` (`#263f80`) |
| Texto principal | `gray-900` |
| Texto secundario | `gray-500` / `gray-600` |
| Bordes | `gray-200` / `gray-300` |
| Fondo página | `gray-100` (desktop) |
| Peligro | `red-500` / `red-600` |
| Éxito / beneficio | `green-600` |
| Advertencia | `amber-50` / `amber-200` (borrador) |

## Modales

Los modales de confirmación usan el componente compartido `Modal` (`src/shared/ui/modal.tsx`):

```tsx
import { Modal } from '@/shared/ui';

<Modal open={showConfirm} onClose={() => setShowConfirm(false)}>
  <h3>Título</h3>
  <p>Mensaje</p>
  <div>
    <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancelar</Button>
    <Button variant="danger" onClick={handleConfirm}>Eliminar</Button>
  </div>
</Modal>
```

Características:
- **Animación de entrada**: Slide-up (translateY 2rem → 0) + fade, 200ms ease-out
- **Cierre instantáneo**: Sin animación de salida, se desmonta al momento
- **Cierre con Escape**: Listener de teclado activo mientras está abierto
- **Click fuera**: Click en el backdrop cierra el modal
- **Centrado**: `items-center justify-center` en todos los tamaños
- **Print**: `no-print` para no aparecer en el PDF

Se usa en: borrar presupuesto, borrar partida, restaurar catálogo, cerrar sesión, eliminar logo.

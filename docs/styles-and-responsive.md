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

La configuración se hace directamente en `src/index.css` con directivas `@import`, `@utility`, y `@custom-variant`.

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
@custom-variant print (&:is(.print *, .print)) {
```

Permite usar clases como `print:block`, `print:hidden`, `print:text-xs` para controlar la visibilidad en PDF.

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

### Layout dual para filas de presupuesto

En lugar de hacer responsive una tabla, se renderizan dos layouts:

**Desktop (tabla)**: `hidden sm:block print:!block`
```html
<table>
  <tr>
    <td>Descripción</td>
    <td>Cant.</td>
    <td>Ud.</td>
    <td>Precio</td>
    <td>Importe</td>
    <td>Margen</td>  <!-- no-print -->
    <td>🗑️</td>      <!-- no-print -->
  </tr>
</table>
```

**Móvil (cards)**: `sm:hidden print:hidden`
```html
<div class="border rounded-lg p-3">
  <div>Descripción + tariff selector + 🗑️</div>
  <div class="grid grid-cols-3">Cant. | Ud. | Precio</div>
  <div>Importe: XX,XX €</div>
</div>
```

## Touch targets

Todos los elementos interactivos tienen un tamaño mínimo de 44×44px (recomendación de accesibilidad WCAG):

```typescript
// Button
'min-h-[44px] py-2'

// Input
'min-h-[44px] py-2'
```

Los pills de categoría en `AddSectionButton` usan `px-3 py-2` para ser fáciles de pulsar en móvil.

## Iconos

Se usa [Lucide React](https://lucide.dev) para todos los iconos. Son SVGs tree-shakeable, cada icono se importa individualmente:

```typescript
import { Plus, Trash2, ArrowLeft, Save, X } from 'lucide-react';
```

Tamaños estándar:
- **14px**: Iconos en botones pequeños, acciones secundarias
- **16px**: Iconos en botones principales, acciones de fila
- **20px**: Iconos decorativos (lista de presupuestos)
- **48px**: Iconos de estado vacío (empty state)

## Temas y colores

No hay sistema de temas/dark mode. Paleta basada en Tailwind defaults:

| Uso | Color |
|---|---|
| Primario (botones, links) | `blue-600` / `blue-700` |
| Texto principal | `gray-900` |
| Texto secundario | `gray-500` / `gray-600` |
| Bordes | `gray-200` / `gray-300` |
| Fondo página | `gray-100` (desktop) |
| Peligro | `red-500` / `red-600` |
| Éxito / beneficio | `green-600` |
| Advertencia | `amber-50` / `amber-200` (borrador) |

## Modales

Los modales de confirmación (borrar presupuesto, restaurar catálogo) usan un patrón simple sin librería:

```html
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
  <div class="bg-white rounded-xl shadow-lg border p-6 w-full max-w-sm mx-4">
    <!-- Contenido -->
  </div>
</div>
```

El overlay `bg-black/40` oscurece el fondo. El modal se centra con flexbox. `mx-4` garantiza márgenes en móvil.

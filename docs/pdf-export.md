# Exportación PDF

## Estrategia

La exportación a PDF usa la función nativa `window.print()` del navegador. No hay librería de generación de PDF — el navegador renderiza la página con estilos de impresión específicos y el usuario la guarda como PDF desde el diálogo de impresión.

**Ventajas**:
- Sin dependencias adicionales (jsPDF, html2canvas, etc.)
- El PDF refleja exactamente lo que se ve en pantalla
- Soporte nativo de tipografías, colores y layout

**Limitaciones**:
- Depende del motor de renderizado del navegador
- El usuario debe seleccionar "Guardar como PDF" manualmente
- No se puede generar PDF en el servidor

## Configuración de impresión

### Tamaño de página

```css
@page {
  size: A4 landscape;
  margin: 0;
}
```

- **A4 landscape**: Los presupuestos de reforma tienen muchas columnas, el formato apaisado aprovecha mejor el espacio.
- **margin: 0**: Elimina los márgenes del navegador (cabeceras/pies con URL, fecha, número de página).

### Padding del contenido

Como `@page margin: 0` elimina todo margen, el contenido necesita su propio padding:

```html
<div class="print:p-[10mm]">
  <!-- Contenido del presupuesto -->
</div>
```

10mm de padding en todos los lados proporciona un margen de lectura cómodo.

## Clases de control

### `no-print`

Clase global que oculta elementos en el PDF:

```css
@media print {
  .no-print {
    display: none !important;
  }
}
```

Se aplica a:
- Botones de acción (guardar, eliminar, exportar)
- Enlace "Volver a presupuestos"
- Banner de borrador
- TariffSelector (dropdown de tarifas)
- Columna "Margen" de la tabla
- Botones de eliminar fila/sección
- Botones de descuento/recargo
- Toggles de secciones
- GripVertical (icono de arrastrar)

### `print:block` / `print:hidden`

Tailwind variant para mostrar/ocultar condicionalmente:

```html
<!-- Datos de empresa: ocultos en pantalla, visibles en PDF -->
<div class="hidden print:flex">
  <img src="logo" class="h-12" />
  <div>Empresa S.L. - CIF: ...</div>
</div>

<!-- Mobile cards: visibles en móvil, ocultas en PDF -->
<div class="sm:hidden print:hidden">
  ...
</div>

<!-- Desktop table: oculta en móvil, forzar visible en PDF -->
<div class="hidden sm:block print:!block">
  <table>...</table>
</div>
```

### `print:!block`

El `!important` es necesario para sobreescribir el `hidden` en la versión móvil. Sin él, si el usuario imprime desde un móvil, la tabla de desktop no se mostraría.

## Estilos de impresión

### Inputs y selects transparentes

En el PDF, los campos de formulario se muestran como texto plano:

```css
@media print {
  input, select {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
    appearance: none;
  }
  select {
    pointer-events: none;
  }
}
```

### Colores exactos

```css
body {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

Fuerza al navegador a imprimir los colores de fondo (que por defecto se omiten en impresión).

### Fondo blanco

```html
<div class="print:bg-white">
```

Elimina el fondo gris de la página para que el PDF sea limpio.

### Sin sombras ni bordes de card

```html
<div class="print:shadow-none print:border-none print:rounded-none">
```

El card wrapper desaparece en el PDF, dejando el contenido directamente sobre el fondo blanco.

## Contenido del PDF

### Cabecera

Visible **solo** en PDF (`hidden print:flex`):

1. **Logo de empresa** (si existe): imagen de 48px de alto
2. **Datos de empresa**: nombre (negrita), CIF, dirección, teléfono, email

### Información del cliente

Siempre visible en PDF (`print:!block`), independientemente del estado del toggle:
- Nombre del cliente
- Dirección de la vivienda
- Fecha
- Nº de presupuesto

### Partidas

Siempre visibles en PDF (`print:!block`):
- Se fuerza el layout de tabla desktop (`print:!block`)
- Se ocultan las cards de móvil (`print:hidden`)
- Columnas visibles: Descripción, Cantidad, Unidad, Precio, Importe
- Columnas ocultas: Margen, botón eliminar

### Resumen

- **Subtotal**: siempre visible
- **Descuento/recargo**: oculto (`no-print`) — el cliente solo ve el precio final
- **IVA (10%)**: siempre visible
- **TOTAL**: siempre visible, en azul y negrita
- **Margen de beneficio**: oculto (`no-print`)

### Elementos ocultos en PDF

| Elemento | Clase |
|---|---|
| Botones de navegación | `no-print` |
| Banner de borrador | `no-print` |
| Toggle "Información del cliente" | `no-print` |
| Toggle "Partidas" | `no-print` |
| GripVertical (drag icon) | `no-print` |
| TariffSelector dropdown | `no-print` |
| Columna Margen | `no-print` |
| Botones eliminar fila | `no-print` |
| Botón eliminar sección | `no-print` |
| AddRowButton | `no-print` (via className) |
| AddSectionButton | `no-print` |
| Detalle ajuste (descuento/recargo) | `no-print` |
| Nota "El cliente no verá este ajuste" | `no-print` |
| Margen de beneficio global | `no-print` |
| Botones de acción (guardar/exportar) | `no-print` |

## Flujo de uso

1. El usuario completa el presupuesto en la app
2. Hace clic en "Exportar PDF" (botón con icono de impresora)
3. Se ejecuta `window.print()`
4. El navegador aplica los estilos `@media print` y `print:*`
5. El diálogo de impresión muestra una preview
6. El usuario selecciona "Guardar como PDF" y elige ubicación

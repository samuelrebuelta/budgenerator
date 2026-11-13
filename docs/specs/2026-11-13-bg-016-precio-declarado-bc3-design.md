# BG-016 — El importador BC3 se fía del precio declarado

Estado: implementado

Fecha: 2026-11-13. Origen: prueba con ficheros BC3 reales de Presto y Arquímedes del 13-11-2026.

## Objetivo

Que un presupuesto real exportado por Arquímedes, Presto o TCQ se pueda importar. Hoy no se puede: el importador recalcula cada precio desde su descomposición y bloquea la importación cuando no coincide con el declarado en el archivo.

## Contexto

El precio de un concepto puede venir dos veces en un `.bc3`: en el registro `~C` (el que el programa imprime en el presupuesto y que el cliente firma) y como suma de su descomposición `~D`. Nunca cuadran al céntimo, porque cada programa redondea a su manera y en cada nivel distinto.

Medido sobre el proyecto del CEIP Villimar (Arquímedes de CYPE, 4.947.480,30 €): tras leer el porcentaje del rendimiento (BG-016 previo, commit `056a7ce`), el total recalculado se queda en 4.898.079,43 €, un 1 % por debajo. Ninguna fórmula lo iguala: de 736 descompuestos con porcentajes, la interpretación en cascada acierta 290 y la aditiva 113; el resto falla por ±0,01 €.

En la aplicación nada edita descomposiciones: el editor de presupuestos trabaja con descripción, cantidad, unidad y precio, y el de catálogo con coste y PVP. Las descomposiciones solo entran por importación y se conservan para volver a exportarlas y para `LineDetail`. Por tanto el precio declarado es el dato bueno, y la descomposición es detalle.

## Alcance y exclusiones

- Incluye:
  - `createRateResolver`: el precio de un concepto es el declarado cuando lo trae; la descomposición solo se usa si no hay precio declarado.
  - `price-mismatch` y `total-mismatch` pasan de error a aviso en presupuestos y obras, con el texto ajustado a que se usa el precio del archivo.
  - Lo mismo con las mediciones: el total declarado en el `~M` manda sobre la suma de sus líneas, y el desfase pasa de error a aviso.
  - El factor del `~D` multiplica a la medición en vez de perderse. Ahí vive el coeficiente de esponjamiento (1,3 sobre los m³ de tierras), y al descartarlo faltaban 10.451,17 € de los 4,9 M€ del proyecto de prueba.
  - La exportación escribe el factor y la medición en bruto por separado, no el producto: así la ida y vuelta conserva el importe.
  - Los avisos siguen apareciendo en la vista previa de importación, para que el titular vea que el archivo se contradice.
- No incluye: cambiar el redondeo del modelo, interpretar los porcentajes en cascada ni editar descomposiciones desde la interfaz.

## Decisión

El precio declarado manda cuando existe y es mayor que cero. Un precio vacío o cero con descomposición se sigue calculando: así los conceptos de porcentaje (`%`, `%CI`), que llevan el precio a cero, no cambian de comportamiento.

## Criterios de aceptación

- [x] Un presupuesto real de Arquímedes se importa sin errores que lo bloqueen y con el mismo total que declara el archivo: el CEIP Villimar entra con sus 4.947.480,30 € exactos.
- [x] La vista previa avisa de que los precios del archivo no cuadran con sus descomposiciones.
- [x] Los conceptos de porcentaje siguen calculándose desde su descomposición.
- [x] El total de un documento creado en la aplicación no cambia: ningún concepto propio trae descomposición.
- [x] La ida y vuelta de BC3 conserva el total, incluido el factor del `~D`.

## Riesgos

- Si un archivo trae un precio declarado desfasado respecto a su descomposición, se importa el desfasado. Es lo que el cliente firmó, y el aviso lo deja visible.
- `flattenItemPrice` deja de cambiar el importe al aplanar, porque ya coinciden. No es un problema: la operación sigue sirviendo para quitar la descomposición antes de editar.

## Tests

- Unitarios: el resolutor prefiere el precio declarado, calcula cuando no lo hay y mantiene los porcentajes; ida y vuelta del códec.
- Reales (`BC3_REAL_DIR`): el proyecto de Arquímedes importa sin errores y con el total declarado.
- E2E: los existentes de importación y exportación BC3.

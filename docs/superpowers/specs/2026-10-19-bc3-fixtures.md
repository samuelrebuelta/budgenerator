# Perfil de fixtures BC3

Estado inicial: sólo fixtures sintéticos; compatibilidad de Presto, Arquímedes y TCQ pendiente de validar con ficheros reales saneados.

## Clases y productores

| Fixture | Clase FIEBDC | Origen | Productor validado | Contenido |
| --- | --- | --- | --- | --- |
| `tests/fixtures/bc3/catalog-minimal.bc3` | Base de datos (tipo 1) | Sintético BudGenerator | No aplica | Conceptos simples y una partida compuesta con precios y descomposición. |
| `tests/fixtures/bc3/budget-minimal.bc3` | Presupuesto (tipo 2) | Sintético BudGenerator | No aplica | Raíz, capítulo, partida, medición simple y línea dimensional. |

No se han recibido ficheros reales de Presto, Arquímedes ni TCQ. Hasta añadirlos y validar sus resultados, ninguna versión de esos programas se anuncia como interoperable.

## Perfil inicial de registros

- `~V`: productor, versión, codificación, tipo de documento y título.
- `~K`: convenciones numéricas/moneda cuando estén presentes.
- `~C`: códigos/sinónimos, unidad literal, resumen, precios por rótulo y tipo de concepto.
- `~D` y `~Y`: descomposiciones y adición de líneas.
- `~M` y `~N`: líneas de medición, posición, dimensiones, expresión, BIM ID y etiqueta, según los campos que se soporten.
- `~T`: texto extendido.
- Otros registros: conservar bytes, orden y referencias como opacos cuando no alteren semántica económica; si pudieran hacerlo, bloquear importación de presupuesto.
- Tipo 3 (certificación) y tipo 4 (actualización de base): fuera de alcance; diagnosticar como tipo no soportado, sin reclasificar.

Las muestras sintéticas cubren el contrato de dominio y parser. Antes de declarar interoperabilidad de aplicación se requieren una base y una obra real por productor, saneadas y con datos autorizados.

## Límites para pruebas de persistencia

La suite generará fixtures de tamaño pequeño, medio y grande a partir del mismo grafo sintético, sin datos reales. El tamaño real de documento/cantidad de escrituras y los límites de lote se medirán contra Firestore Emulator antes de fijar cuotas de importación. No se guardan binarios BC3 en Firestore.

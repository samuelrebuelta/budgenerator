# Perfil de fixtures BC3

Estado (12-11-2026): sólo fixtures sintéticos (los del borrador anterior se sustituyeron: estaban en UTF-8 declarando ANSI y usaban `##` como prefijo); compatibilidad de Presto, Arquímedes y TCQ pendiente de validar con ficheros reales saneados.

## Clases y productores

| Fixture | Clase FIEBDC | Origen | Productor validado | Contenido |
| --- | --- | --- | --- | --- |
| `tests/fixtures/bc3/base-precios-ansi.bc3` | Base de datos (tipo 1), ANSI | Sintético | No aplica | `~K`, capítulos `#`, sinónimos, dos rótulos de precio, descomposición triple y cuádruple con `%`, `~T` multilínea, `~X` opaco, concepto suelto. |
| `tests/fixtures/bc3/obra-mediciones-850.bc3` | Presupuesto (tipo 2), página 850 | Sintético | No aplica | Capítulos anidados, partida en la raíz, concepto en dos capítulos, `~M` con varias líneas, subtotal y expresión `a*b*d`, `~K` con GG/BI/IVA, `~L` opaco, totales declarados que cuadran al céntimo (651,36). |
| `tests/fixtures/bc3/certificacion.bc3` | Certificación (tipo 3) | Sintético | No aplica | Debe rechazarse. |

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

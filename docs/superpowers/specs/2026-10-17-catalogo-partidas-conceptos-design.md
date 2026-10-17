# Diseño — Partidas y conceptos unificados

## Intención

Hacer que catálogo, asistente, presupuestos y plantillas usen la misma jerarquía visible: una **partida** agrupa varios **conceptos**. Una partida como «Fontanería» del catálogo debe ser la misma estructura que se puede elegir al preparar un presupuesto; el usuario no debe reconciliar categorías de tarifas con capítulos de presupuesto.

## Problema actual

El catálogo persiste una lista plana de `Tariff` y una categoría de texto por tarifa. Presupuestos y plantillas persisten bloques `WorkItem` con tareas. El asistente reconstruye los bloques agrupando tarifas por el texto de su categoría. El nombre es la única relación; una categoría renombrada, vacía o distinta de un bloque ya existente no representa una entidad compartida. Además, `AddWorkItemButton` rellena su selector desde la constante `RENOVATION_CATEGORIES`, no desde las partidas/conceptos reales del catálogo. Por eso ofrece opciones distintas a las que el usuario mantiene en `/catalog`. La interfaz también llama a categorías «trabajos/capítulos» y a tarifas «conceptos», sin un único modelo detrás.

## Objetivos

- El catálogo mantiene partidas con ID y nombre, cada una con sus conceptos.
- El asistente elige partidas del catálogo, y después conceptos pertenecientes a esas partidas.
- Un presupuesto contiene las partidas elegidas y una copia editable de los conceptos elegidos, con precio, coste, unidad y cantidad por línea.
- Una plantilla reutiliza la misma forma de partidas y conceptos que un presupuesto.
- Buscar, ordenar, sugerir usos frecuentes, editar y aplicar conceptos opera dentro de una partida identificada, no infiriéndola de un texto libre.
- Mantener los presupuestos, plantillas, cálculos, PDF y enlaces públicos existentes.

## Decisión propuesta

Usar `Partida` como estructura con identidad estable (`id`, `name`) y una colección `concepts`. El catálogo guarda `CatalogPart[]`; cada concepto de catálogo incluye sus valores de tarifa. Presupuesto y plantilla guardan snapshots de `Partida[]`; sus conceptos añaden la cantidad editable y conservan los campos económicos ya usados por cálculos/PDF. Al elegir en el catálogo se copian valores al snapshot. Los cambios posteriores del catálogo no mutan presupuestos ni plantillas ya creados. El selector de partidas del editor se alimenta de esas partidas reales; la lista fija `RENOVATION_CATEGORIES` deja de ser fuente para ese flujo.

La creación guiada comienza seleccionando partidas del catálogo; el paso de conceptos filtra los conceptos por ID de partida. Las sugerencias de uso frecuente se calculan por el ID estable de concepto cuando exista y sólo se derivan del historial privado cargado; para presupuestos históricos sin ese ID se conserva la coincidencia por nombre de partida, descripción normalizada y unidad. Las acciones normales de añadir partida/concepto reutilizan la misma estructura. Una partida puede tener varios conceptos; el presupuesto sólo incorpora las líneas seleccionadas y no crea bloques vacíos.

En la interfaz se usarán «Partidas» y «Conceptos» en catálogo, presupuesto, plantilla, búsqueda, asistente y accesibilidad. El orden alfabético pedido se mantiene en el catálogo y búsqueda; el orden del presupuesto seguirá siendo editable.

## Compatibilidad y datos

- El documento canónico existente es `users/{uid}/tariffCatalogs/main-v1`, actualmente con un array plano de tarifas; guardar ahí la forma anidada nueva. Mantenerlo en un documento como hoy y comprobar su tamaño frente al límite de Firestore de 1 MiB.
- Leer el catálogo actual plano (`Tariff.category`) agrupándolo por categoría y asignar IDs de partida deterministas para que la conversión sea repetible. Guardar el nuevo formato en el documento canónico sin perder descripciones, unidades, costes o precios.
- Aceptar el formato antiguo al leer, y escribir en el nuevo formato al guardar. La conversión ocurre en el flujo de inicialización existente, por cuenta y con escrituras acotadas; sin script de borrado global.
- Presupuestos, plantillas y snapshots públicos antiguos continúan leyéndose con el adaptador actual. No se reescriben documentos históricos en lote. Sus bloques son snapshots válidos aunque no correspondan a una partida actual del catálogo.
- Las nuevas partidas/conceptos de presupuesto pueden conservar el `catalogPartId`/`catalogConceptId` de origen como metadatos opcionales, pero todos los importes y nombres usados en un presupuesto siguen siendo su snapshot editable.
- No cambiar reglas de Firestore salvo que las pruebas demuestren que el nuevo documento supera alguna restricción actual; si sucede, documentarlo y cubrirlo con emulador antes de desplegar.

## Fuera de alcance

Sin sincronización retroactiva de presupuestos o plantillas al cambiar el catálogo, sin borrado remoto global, sin IA, sin cambios de planes/roles, cuota, fórmulas comerciales ni funcionalidades de colaboración. No reabrir en esta tarea los retoques visuales o PWA de BG-008 ya publicados.

## Aceptación

1. El catálogo muestra y edita partidas; cada una contiene sus conceptos y no hay selector de categoría libre que cree una relación sólo textual.
2. Una partida puede renombrarse sin separar sus conceptos ni romper el asistente.
3. El asistente lista exactamente las partidas del catálogo, permite seleccionar conceptos de cada una, retroceder y confirmar una sola vez.
4. El presupuesto resultante guarda una copia editable con identidad de origen; cambios en catálogo no modifican ese presupuesto ni las plantillas existentes.
5. Crear y editar partidas/conceptos en presupuesto y plantilla mantiene la estructura anidada. Buscar un concepto respeta la partida seleccionada y muestra su unidad y precio.
6. Catálogo antiguo plano se convierte de manera idempotente; los presupuestos/plantillas históricos y enlaces públicos se siguen mostrando y exportando.
7. Se conserva aislamiento entre cuentas, y las pruebas de emulador cubren carga concurrente y reintento de conversión.
8. Actualizar especificación/contratos y registrar pruebas reales. La versión anterior de BG-008 estaba desplegada para prueba; esta extensión se desplegó sólo a Hosting tras la instrucción explícita del usuario del 17-10-2026.

## Decisiones de implementación abiertas al constructor

- Elegir la ubicación de los adaptadores de compatibilidad respetando `entities/catalog` y los mappers existentes de budget/template.
- Mantener compatibilidad de `schemaVersion: 2` para DTOs públicos si el snapshot de presupuesto permanece idéntico semánticamente; incrementar versión sólo si la lectura pública no puede seguir compatible.
- Reutilizar los componentes del editor y la búsqueda actuales, reduciendo duplicidad sin refactor general.

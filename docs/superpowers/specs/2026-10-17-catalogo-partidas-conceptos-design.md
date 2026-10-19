# Diseño — Capítulos y partidas unificados

## Intención

Hacer que catálogo, asistente, presupuestos y plantillas usen la misma jerarquía visible: un **capítulo** agrupa varias **partidas**. Un capítulo como «Fontanería» del catálogo debe ser la misma estructura que se puede elegir al preparar un presupuesto.

## Problema actual

El catálogo persiste una lista plana de `Tariff` y una categoría de texto por tarifa. Presupuestos y plantillas persisten bloques `WorkItem` con tareas. El asistente reconstruye los bloques agrupando tarifas por el texto de su categoría. El nombre es la única relación; una categoría renombrada, vacía o distinta de un bloque ya existente no representa una entidad compartida. Además, `AddWorkItemButton` rellena su selector desde la constante `RENOVATION_CATEGORIES`, no desde el catálogo real. Por eso ofrece opciones distintas a las que el usuario mantiene en `/catalog`.

## Objetivos

- El catálogo mantiene capítulos con ID y nombre, cada uno con sus partidas.
- El asistente elige capítulos del catálogo, y después partidas pertenecientes a esos capítulos.
- Un presupuesto contiene los capítulos elegidos y una copia editable de las partidas elegidas, con precio, coste, unidad y cantidad por línea.
- Una plantilla reutiliza la misma forma de capítulos y partidas que un presupuesto.
- Buscar, ordenar, sugerir usos frecuentes, editar y aplicar partidas opera dentro de un capítulo identificado, no infiriéndolo de un texto libre.
- Mantener los presupuestos, plantillas, cálculos, PDF y enlaces públicos existentes.

## Decisión propuesta

Las claves y tipos existentes se mantienen por compatibilidad: `CatalogPart[]` representa capítulos en la interfaz y cada `concepts[]` representa partidas; en presupuestos y plantillas, cada `WorkItem` es un capítulo y sus tareas son partidas. Los snapshots conservan sus campos económicos y cantidades editables. Al elegir en el catálogo se copian valores al snapshot. Los cambios posteriores del catálogo no mutan presupuestos ni plantillas ya creados. El selector de capítulos del editor se alimenta de esos capítulos reales; la lista fija `RENOVATION_CATEGORIES` deja de ser fuente para ese flujo.

La creación guiada comienza seleccionando capítulos del catálogo; el paso de partidas filtra por ID de capítulo. Las sugerencias de uso frecuente se calculan por el ID estable de partida cuando exista y sólo se derivan del historial privado cargado; para presupuestos históricos sin ese ID se conserva la coincidencia por nombre de capítulo, descripción normalizada y unidad. Una vez en el editor, se pueden añadir capítulos y partidas. Un capítulo puede tener varias partidas; el presupuesto sólo incorpora las líneas seleccionadas y no crea capítulos vacíos.

En los textos visibles se usarán «Capítulos» y «Partidas» en catálogo, presupuesto, plantilla, búsqueda, asistente, ayuda, proyectos y PDF. «Concepto» no se usará como sinónimo de partida. Se mantienen las claves internas existentes (`parts`, `concepts`, `workItems`, `tasks`, `catalogPartId`, `catalogConceptId`) y los datos guardados; no hace falta migrar Firestore. El orden alfabético del catálogo y la búsqueda se mantiene; el del presupuesto seguirá siendo editable.

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

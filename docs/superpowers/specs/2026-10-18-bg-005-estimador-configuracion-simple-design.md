# BG-005 — Configuración simple por estancia

**Estado:** refinamiento solicitado por el usuario el 18-10-2026. Mantiene el flujo de leads y enlaces revocables.

## Intención

Reducir el trabajo necesario para preparar el estimador. La empresa elige estancias una sola vez y configura tarifas orientativas por metro cuadrado, sin crear una combinación independiente por cada calidad y concepto.

## Experiencia de configuración

- Un wizard privado conduce por selección de estancias, precios y publicación.
- Cada estancia se configura una vez con un rango manual «desde/hasta» por m² para calidad media.
- Un control de incremento, con botones −/+ de 1 €/m², define la diferencia entre niveles. Alta añade un incremento y lujo añade dos. No se inventa un porcentaje de variación.
- La empresa puede guardar, publicar, copiar o revocar el enlace; la pantalla muestra el progreso, requisitos y errores junto a la acción correspondiente.
- Se conservan los controles de contacto público y el requisito de nombre de empresa y aviso de privacidad HTTPS para publicar.

## Formulario y cálculo público

- El visitante elige una reforma parcial o integral una vez y añade cada estancia física por separado. Cada instancia tiene superficie aproximada y calidad de materiales propias, por ejemplo Baño 1: 3 m² y Baño 2: 7 m².
- Una integral requiere seleccionar las estancias que incluye. La horquilla suma, para cada instancia, superficie × precio mínimo/máximo por m² de la calidad elegida.
- Cada tipo admite hasta 20 instancias. Los datos históricos que usan `quantity` agrupada y no tienen `instanceId` se siguen calculando y muestran su cantidad/superficie agregadas.
- La tarifa por m² se introduce manualmente como aproximación de la empresa; la horquilla no aplica margen automático. Para una estancia, la calidad media define la base y el incremento define alta y lujo.
- La función recalcula en servidor a partir de la configuración privada. El navegador no obtiene tarifas antes de pedir una estimación ni puede escribir leads directamente.
- Se mantienen contacto, consentimiento, plazo de inicio, almacenamiento idempotente del lead, borrado manual, conversión a presupuesto y el token revocable.

## Compatibilidad

- La configuración anterior basada en conceptos del catálogo permanece identificada como esquema 1. Functions y el formulario público siguen aceptándola para que los enlaces activos no se rompan.
- La configuración nueva usa esquema 2. Al guardar o publicar, el enlace de la empresa pasa a usar las nuevas tarifas; los leads existentes conservan su información y etiquetas históricas de calidad.
- Si la empresa tiene configuración anterior, la pantalla lo explica y deja iniciar el wizard nuevo. No se convierten automáticamente conceptos o cantidades, porque una equivalencia a €/m² no es fiable para unidades fijas.
- El esquema 1 conserva lectura del catálogo en servidor. El esquema 2 usa sus tarifas manuales; no requiere exponer ni leer catálogo para calcular.
- Los selectores numéricos del formulario tienen una altura táctil mayor, también en el plazo aproximado de inicio.

## Refinamiento de interacción — 18-10-2026

- La configuración privada tiene ruta y entrada propias en el menú principal; la ruta anterior redirige y ya no muestra un retorno a Mi empresa.
- Su resumen conserva el enlace publicado y permite abrirlo, copiarlo, revocarlo o borrar la configuración. Borrar revoca el token y elimina solo la configuración; conserva leads.
- Mi empresa mantiene los bloques de Estimador y Solicitudes, con enlaces «Ver».
- La configuración privada y el formulario público muestran skeletons mientras cargan. Los selects compartidos tienen altura mínima de 56 px.

## Fuera de alcance

- Cambios en reglas de Firestore, retención de leads, elegibilidad Free/Pro o publicación de una landing.
- Cambios en la fórmula de precio histórico de configuraciones esquema 1.
- Conversión automática de la horquilla a partidas o precio de un presupuesto.

# Diseño: intercambio BC3 en BudGenerator

Estado: propuesta revisada el 20-10-2026 con autorización para rediseñar el modelo de datos; plan SDD preparado para revisión antes de implementar.

## Intención

Permitir que empresas de reformas reutilicen en BudGenerator información que ya reciben en formato BC3 y que puedan entregar su catálogo y presupuestos a otras herramientas compatibles. El alcance acordado para estudiar incluye importar bases de precios al catálogo, importar presupuestos que puedan adaptarse al modelo de BudGenerator y exportar datos propios a BC3.

## Por qué

FIEBDC-3/2024 define BC3 como formato de intercambio de bases de datos, obras y certificaciones. Su objetivo es reconstruir esa información en otra aplicación. Facilita incorporar partidas y precios sin teclear todo de nuevo y continuar en BudGenerator el trabajo iniciado con un programa de mediciones y presupuestos. La [especificación oficial de FIEBDC-3/2024](https://www.fiebdc.es/web2/datos/uploads/Formato-FIEBDC-3-2024.pdf) indica que una implementación del formato debe contemplar entrada y salida; por ello el proyecto trata importación y exportación como una entrega conjunta.

Hipótesis a validar con muestras de usuarios: el flujo más frecuente es recibir una base o presupuesto BC3 de un colaborador y después modificarlo, o exportar el trabajo propio para compartirlo. Aún no hay muestras reales ni investigación de uso en el repositorio.

## Objetivos

- Importar un BC3 de base de precios al catálogo privado de la cuenta, con partidas, conceptos, unidades y precios reconocidos.
- Importar un BC3 de obra como presupuesto nuevo cuando sus capítulos, partidas, mediciones y precios puedan representarse en BudGenerator.
- Exportar catálogo, presupuestos y plantillas de BudGenerator a archivos `.bc3` que se puedan abrir en software compatible.
- Ofrecer vista previa, resumen de cambios y avisos explícitos antes de persistir o descargar.
- Hacer que el modelo canónico de presupuestos, catálogos y plantillas represente nativamente la estructura FIEBDC, para importar y exportar sin aplanar ni reconstruir datos desde los modelos actuales.
- Reutilizar autenticación, cuota y ciclo de guardado de la app, rediseñando el esquema Firestore, las reglas y los consumidores que dependan del modelo actual cuando haga falta.
- Implementar sin dependencias nuevas y sin llamadas a backend para interpretar archivos del usuario.

## No objetivos

- Importar certificaciones, pliegos, adjuntos, gráficos, relaciones comerciales, datos BIM o descripciones paramétricas en la primera entrega.
- Integrar proveedores de bancos de precios remotos o autenticación de terceros.
- Convertir BC3 a `WorkItem[]`/`BudgetTask[]` o `CatalogPart[]` como modelo persistido canónico.
- Prometer una conversión sin pérdida de información de cualquier BC3. Los datos que no tengan representación equivalente se deben advertir y no transformar silenciosamente.
- Modificar datos reales o de producción durante pruebas, ejecutar una migración de producción, desplegar o fusionar cambios sin autorización específica.

## Restricciones y estado actual

- TypeScript estricto, React, Vite, Zustand y Firebase; respetar `app → pages → features → entities → shared`.
- No añadir dependencias sin aprobación; inspeccionar licencia y mantenimiento de cualquier parser candidato antes de reconsiderar esta restricción.
- El modelo actual separa catálogo (`CatalogPart[]`) y presupuesto (`WorkItem[]`/`BudgetTask[]`) y no representa árbol arbitrario, códigos FIEBDC, descomposiciones, mediciones detalladas ni registros extendidos.
- El selector de unidad está cerrado a `m2`, `m3`, `ml`, `unit` y `hour`.
- La base del proyecto es Firestore Standard en `europe-southwest1`. Firestore limita cada documento a 1 MiB y recomienda subcolecciones cuando listas crecen; las importaciones pueden exceder el tamaño práctico de un documento agregado. [Límite/tamaño de documentos](https://firebase.google.com/docs/firestore/storage-size) · [Elección de estructura](https://firebase.google.com/docs/firestore/manage-data/structure-data).
- El guardado actual de presupuesto consume cuota en una transacción sobre el contador de usuario. El nuevo almacenamiento debe preservar esta regla sin exigir una transacción única para una obra entera.
- No hay usuarios en producción. El usuario autoriza cambios del modelo y esquema de datos. Esto elimina la obligación de preservar el contrato plano como modelo activo, pero no autoriza borrar ni migrar datos remotos sin inspección y una operación explícita.
- La lógica PDF está separada. La implementación BC3 debe evitar alterar los importes o exportaciones PDF existentes.
- El formato tiene registros con delimitadores, versiones y campos con caracteres escapados; requiere fixtures representativos y validación de importes antes de ampliar cobertura.

## Modelo canónico propuesto

### Documento de construcción

Presupuestos, catálogos y plantillas compartirán un núcleo de dominio FIEBDC y diferirán en metadatos de negocio. El núcleo guardará la identidad/versiones del formato, conceptos indexados por su código original, la jerarquía de capítulos y referencias, relaciones de descomposición, unidades literales, precios identificados por rótulo, textos y líneas de medición con sus factores/expresiones. Mantendrá el orden de origen y la precisión numérica necesaria para reproducir los importes. No convertirá capítulos a grupos planos ni mediciones a una cantidad agregada.

Un presupuesto añadirá cliente, obra, fecha, IVA/ajustes aprobados, aceptación y enlaces a proyecto. Un catálogo contendrá conceptos reutilizables y precios; una plantilla será el mismo tipo de estructura con metadatos propios. Los proyectos referenciarán el presupuesto aceptado y guardarán el avance por ocurrencia/partida, sin mutar la definición de conceptos original. Se actualizarán cálculos, editor, PDF, compartir y conversión a proyecto para consumir el nuevo modelo.

El modelo incluirá registros centrales FIEBDC en tipos propios y conservará registros no interpretados como extensiones opacas, con su orden y contenido, mientras no se editen referencias que los invaliden. La primera cobertura funcional se limita a registros validados con los fixtures; si una importación de presupuesto no puede preservar una partida, medición o efecto económico, se bloquea.

### Persistencia

Usar un documento raíz ligero con `schemaVersion`, tipo, metadatos y estado; almacenar conceptos, nodos de estructura, mediciones y extensiones en subcolecciones para evitar documentos agregados grandes. Los stores cargarán/escribirán el grafo con orden explícito. La importación se escribe en estado de staging por bloques y se marca lista al completar; sólo el estado listo aparece en listas. El finalizado de un presupuesto debe consumir cuota una sola vez en la transacción actual, y el fallo/cancelación limpia documentos de staging sin publicar un borrador parcial. Se definirán reglas para cada subcolección y borrado recursivo.

El nombre exacto de las colecciones, chunking y proceso de recuperación se validará con fixtures grandes antes de implementar; no almacenar el archivo binario original en Firestore. La lectura/escritura BC3 y el modelo de dominio conservarán la misma semántica, sin adaptadores que conviertan al modelo plano actual.

## Diseño de intercambio

### Núcleo del formato

Crear un módulo local y puro bajo `src/shared/lib/bc3/` que lea bytes BC3 directamente al modelo canónico FIEBDC y serialice el mismo modelo sin una segunda proyección. Diagnósticos con severidad, código estable, número de registro y mensaje en español. Reconocerá versión/cabecera, conceptos, descomposiciones, textos, mediciones, coeficientes y extensiones cubiertos por el perfil de compatibilidad. Los registros no interpretados se conservan opacos cuando se pueda garantizar que no se rompen sus referencias.

Se priorizan archivos exportados por Presto, Arquímedes y TCQ. El primer alcance de versiones se fija en fixtures reales saneados de esas aplicaciones; se diseñará el lector para FIEBDC-3/2024 y compatibilidad hacia atrás sólo donde haya casos verificables. Si no se dispone de muestra de una aplicación, se podrá desarrollar contra fixtures sintéticos, pero no se anunciará compatibilidad de esa fuente hasta validarla con un archivo real.

### Importación del catálogo

La persona seleccionará un `.bc3`, verá nombre/versión del origen, partidas y conceptos detectados, número de duplicados, precios ausentes/no válidos y registros extendidos. El BC3 completo se conservará como catálogo FIEBDC en el modelo nativo; además, podrá elegir conceptos/capítulos para incorporar al catálogo de trabajo mediante referencias o copia nativa, sin perder la fuente importada ni sus códigos. El precio simple de BC3 corresponde al precio de venta de BudGenerator. El coste queda en cero cuando el archivo no expresa un coste inequívoco; no se infiere desde precio de venta. La unidad se almacena literalmente. Catálogos importados son privados y nunca reemplazan automáticamente el catálogo de trabajo.

### Importación del presupuesto

La persona podrá importar una obra BC3 como presupuesto nativo, conservando la jerarquía, códigos, unidades, precios, descomposiciones y mediciones representadas por el modelo. La previsualización mostrará árbol, totales, versiones, extensiones y diferencias antes de guardar. El coste queda en cero sólo cuando no exista dato inequívoco de coste. El IVA/ajuste seguirá como metadato de negocio salvo equivalente exacto en fuente.

Si una estructura o registro no se puede preservar en el documento nativo, la vista previa bloqueará la importación presupuestaria; no hay descarte parcial. Las extensiones desconocidas sólo son admisibles cuando se retienen con sus bytes/orden y no afectan al cálculo o edición.

La importación confirmada crea un documento de presupuesto en staging y lo publica al completar su escritura, consumiendo la cuota existente una sola vez. No modifica ni reemplaza otro documento.

### Exportación

Exportar catálogos, presupuestos y plantillas a `.bc3` desde el modelo canónico compartido mediante descarga local. Mantener códigos, orden, jerarquía, mediciones y relaciones. Los documentos creados en BudGenerator recibirán códigos FIEBDC estables al crearse. Metadatos de negocio que no tengan equivalente en FIEBDC se exportarán en las extensiones acordadas o se mostrarán como exclusión explícita; no se ocultará una pérdida.

Las plantillas forman parte de la exportación inicial como estructuras reutilizables. La compatibilidad de esa representación se verificará con las aplicaciones objetivo.

### Experiencia y seguridad

- Los archivos se procesan localmente y no se almacenan ni suben a Firebase.
- La UI usa acciones de catálogo/presupuesto existentes y componentes accesibles; revisa escritorio y móvil según `docs/styles-and-responsive.md`.
- La vista previa declara explícitamente registros opacos, unidades literales, incompatibilidades y diferencia de total. Si hay pérdida semántica no permite confirmar.
- Confirmar es una sola operación; cancelar no cambia stores ni documentos.
- Un error de parseo nunca deja el catálogo o el borrador medio actualizado.

## Criterios de aceptación propuestos

1. Leer archivos BC3 válidos de cada versión/productor cubierto por fixtures y rechazar archivos truncados o mal formados con diagnóstico útil.
2. Importar catálogo con partidas, descripciones, unidades y precios, omitiendo duplicados y conservando los precios personalizados del catálogo destino.
3. Importar presupuesto simple soportado con total coincidente al centavo bajo la política de cálculo definida y abrirlo como borrador editable.
4. Bloquear la importación de presupuestos cuando no se puedan representar fielmente sus partidas, mediciones o efectos económicos; no ofrecer descarte parcial.
5. Exportar catálogo, presupuesto y plantilla y reimportarlos manteniendo códigos, orden, estructura, mediciones y cálculos del perfil FIEBDC soportado.
6. Cancelar no escribe datos; confirmar no duplica al doble clic; cambiar de sesión durante una operación no contamina datos de otra cuenta.
7. Probar las reglas nuevas o modificadas con emuladores antes de considerarlas seguras; no desplegar reglas ni Functions como parte de la verificación local.
8. Checks de cierre según instrucciones del proyecto y capturas responsive.

## Decisiones confirmadas

- Bloquear la importación de presupuesto cuando no se pueda conservar completamente su semántica; no permitir descartes confirmados.
- Priorizar Presto, Arquímedes y TCQ. Aún no hay archivos de muestra adjuntos; incorporarlos antes de anunciar compatibilidad.
- Rediseñar el modelo canónico para estructura FIEBDC, incluyendo unidades libres y jerarquía/mediciones nativas.
- Importar el precio BC3 como precio de venta y fijar coste a cero cuando el archivo no exprese un coste inequívoco.
- Incluir plantillas en la exportación inicial como estructuras reutilizables.

## Decisiones de implementación propuestas

- Una unidad libre se conserva literalmente como texto y se exporta sin normalizar; las unidades conocidas mantienen sus etiquetas y controles actuales.
- Los flujos del estimador público siguen aceptando sólo unidades con semántica conocida. El catálogo puede contener unidades libres, pero no se permite usarlas en un cálculo del estimador hasta definir una conversión segura.
- La capa de interfaz/calculo puede derivar vistas del modelo canónico, pero no persistirá una copia aplanada que compita con la fuente FIEBDC.
- Los documentos existentes de prueba no se migran ni se borran automáticamente. Cualquier migración de datos remotos requiere inventario/backup, prueba de emulador y autorización específica.

## Riesgos

- Variantes reales de codificación, separadores, caracteres escapados y versiones; cubrir sólo la versión formal no garantiza compatibilidad con todos los exportadores.
- Descomposiciones y mediciones detalladas pueden ser relevantes para precio y total aunque el modelo actual sólo almacene una cantidad y un precio unitario.
- La unidad libre debe mostrarse y exportarse correctamente en presupuesto, catálogo, plantillas, proyectos y PDF; la feature rediseña los contratos persistidos y varios consumidores de UI.
- La interpretación incorrecta de un precio o coeficiente puede causar presupuestos con totales plausibles pero erróneos; comparar siempre origen y destino en vista previa.
- El requisito bidireccional FIEBDC hace mayor la entrega que un parser de importación aislado.

## Documentación relacionada

Actualizar `docs/plan.md`, `docs/architecture.md`, `docs/state-and-cache.md`, `docs/performance.md`, `docs/styles-and-responsive.md` y `docs/firebase.md` al implementar. Esta propuesta y su plan no modifican código, reglas ni datos.

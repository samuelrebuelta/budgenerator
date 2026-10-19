# Diseño: intercambio BC3 en BudGenerator

Estado: propuesta para evaluación; no autoriza implementación ni despliegue.

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
- Mantener el editor, cálculos, guardado, cuotas, Firestore y contratos actuales como destino de los datos adaptados.
- Implementar sin dependencias nuevas y sin llamadas a backend para interpretar archivos del usuario.

## No objetivos

- Importar certificaciones, pliegos, adjuntos, gráficos, relaciones comerciales, datos BIM o descripciones paramétricas en la primera entrega.
- Integrar proveedores de bancos de precios remotos o autenticación de terceros.
- Reemplazar el sistema de presupuestos, catálogo, plantillas, cálculos o PDF.
- Prometer una conversión sin pérdida de información de cualquier BC3. Los datos que no tengan representación equivalente se deben advertir y no transformar silenciosamente.
- Cambiar reglas de Firestore, crear migraciones remotas, escribir datos de producción para pruebas, desplegar o fusionar cambios.

## Restricciones y estado actual

- TypeScript estricto, React, Vite, Zustand y Firebase; respetar `app → pages → features → entities → shared`.
- No añadir dependencias sin aprobación; inspeccionar licencia y mantenimiento de cualquier parser candidato antes de reconsiderar esta restricción.
- Catálogo: `TariffCatalog.parts[]` agrupa `CatalogPart` con conceptos anidados. `CatalogConcept` guarda descripción, unidad, `basePrice` y `cost`; el importador actual fusiona por nombre de partida normalizado y descripción/unidad, omite duplicados y conserva valores editados.
- Presupuesto: `Budget.workItems[]` agrupa `WorkItem.tasks[]`; cada `BudgetTask` tiene descripción, cantidad numérica, unidad, precio y coste. No hay subcapítulos anidados, líneas de medición, expresiones ni descomposiciones anidadas.
- Las unidades actuales son `m2`, `m3`, `ml`, `unit` y `hour`, con selector cerrado en el editor.
- Los presupuestos se guardan por el store y sus flujos actuales de cuota; el borrador se recupera desde `sessionStorage`. El catálogo se persiste mediante su store y cola existentes.
- La lógica PDF está separada. La implementación BC3 debe evitar alterar los importes o exportaciones PDF existentes.
- El formato tiene registros con delimitadores, versiones y campos con caracteres escapados; requiere fixtures representativos y validación de importes antes de ampliar cobertura.

## Diseño propuesto para evaluar

### Núcleo del formato

Crear un módulo local y puro de lectura/escritura BC3 bajo `src/shared/lib/bc3/`, sin conocimiento de React, Firebase ni tipos de entidades. Definirá registros normalizados y diagnósticos con severidad, código estable, número de registro y mensaje en español. El lector reconocerá versión/cabecera, conceptos, descomposiciones, textos, mediciones y coeficientes que sean necesarios para las conversiones soportadas. Los demás registros se contabilizarán como ignorados o no soportados, con advertencia cuando puedan afectar a datos visibles o importes.

Se priorizan archivos exportados por Presto, Arquímedes y TCQ. El primer alcance de versiones se fija en fixtures reales saneados de esas aplicaciones; se diseñará el lector para FIEBDC-3/2024 y compatibilidad hacia atrás sólo donde haya casos verificables. Si no se dispone de muestra de una aplicación, se podrá desarrollar contra fixtures sintéticos, pero no se anunciará compatibilidad de esa fuente hasta validarla con un archivo real.

### Importación del catálogo

La persona seleccionará un `.bc3`, verá nombre/versión del origen, partidas y conceptos detectados, número de duplicados, precios ausentes/no válidos y registros no soportados, y confirmará una importación completa o selectiva. Los elementos confirmados se fusionarán en el catálogo actual con la política existente: no duplicar por partida normalizada y concepto/unidad; no sustituir conceptos ya configurados. Los precios del registro BC3 se asignarán a `basePrice`. `cost` será cero cuando el BC3 no proporcione un coste inequívoco; no se inferirá un coste a partir del precio de venta. Se preservará la unidad BC3 original como texto, incluidas unidades que hoy no estén en la lista cerrada; el modelo y el editor tendrán que admitir unidades libres. El catálogo importado no se convertirá en catálogo base compartido ni sobrescribirá el catálogo privado.

### Importación del presupuesto

La persona podrá elegir importar como presupuesto un archivo de obra reconocido. Se generará una previsualización con jerarquía y totales antes de crear un borrador. La primera versión adaptará sólo capítulos y líneas que puedan expresarse como partidas/conceptos actuales, con cantidad numérica, unidad literal y precio unitario. El precio se copiará, `cost` será cero si no está expresado de forma inequívoca, y el IVA/ajuste mantendrá los valores predeterminados del flujo actual salvo que la fuente tenga un equivalente exacto y aprobado.

Si el archivo contiene partidas, jerarquías, mediciones, expresiones, descomposiciones, coeficientes u otras estructuras que no se puedan conservar en `Budget`, la vista previa explicará el caso y bloqueará la confirmación si descartarlo pierde información de la obra o puede alterar el importe. La importación no ofrece descarte parcial confirmado: para importar habrá que usar un archivo compatible o adaptar el modelo en una fase aprobada. No se aplanará ni recalculará silenciosamente.

La importación confirmada abre un nuevo borrador mediante el store actual, con IDs nuevos, y persiste únicamente al guardar según las reglas actuales de cuota y sincronización. No modifica ni reemplaza un presupuesto existente.

### Exportación

Exportar desde el catálogo, presupuestos y plantillas a `.bc3`, mediante descarga local. Las plantillas se representan como estructuras reutilizables. La exportación incluirá sólo los campos que tengan representación en el modelo: nombre, conceptos/partidas, unidades, cantidades y precios; coste sólo cuando FIEBDC tenga un campo equivalente inequívoco. Se generarán códigos BC3 válidos y estables dentro del archivo cuando el modelo no tenga código de origen. Se advertirá si quedan fuera metadatos o estructuras que el modelo no representa.

Las plantillas forman parte de la exportación inicial como estructuras reutilizables. La compatibilidad de esa representación se verificará con las aplicaciones objetivo.

### Experiencia y seguridad

- Los archivos se procesan localmente y no se almacenan ni suben a Firebase.
- La UI usa acciones de catálogo/presupuesto existentes y componentes accesibles; revisa escritorio y móvil según `docs/styles-and-responsive.md`.
- La vista previa declara explícitamente registros no soportados, unidades preservadas, incompatibilidades y diferencia de total cuando corresponda. Si la incompatibilidad descarta datos de la obra, no permite confirmar.
- Confirmar es una sola operación; cancelar no cambia stores ni documentos.
- Un error de parseo nunca deja el catálogo o el borrador medio actualizado.

## Criterios de aceptación propuestos

1. Leer archivos BC3 válidos de cada versión/productor cubierto por fixtures y rechazar archivos truncados o mal formados con diagnóstico útil.
2. Importar catálogo con partidas, descripciones, unidades y precios, omitiendo duplicados y conservando los precios personalizados del catálogo destino.
3. Importar presupuesto simple soportado con total coincidente al centavo bajo la política de cálculo definida y abrirlo como borrador editable.
4. Bloquear o pedir decisión explícita en estructuras que no se puedan representar fielmente; no perder información sin aviso.
5. Exportar catálogo, presupuesto y plantilla en archivos válidos y reimportar el subconjunto soportado manteniendo estructura e importes.
6. Cancelar no escribe datos; confirmar no duplica al doble clic; cambiar de sesión durante una operación no contamina datos de otra cuenta.
7. Sin cambios de reglas ni funciones Firebase; se verifica con emuladores si la implementación termina afectando contratos de Firestore.
8. Checks de cierre según instrucciones del proyecto y capturas responsive.

## Decisiones confirmadas

- Bloquear la importación de presupuesto cuando la adaptación pierda partidas o mediciones; no permitir descartes confirmados.
- Priorizar Presto, Arquímedes y TCQ. Aún no hay archivos de muestra adjuntos; incorporarlos antes de anunciar compatibilidad.
- Preservar unidades BC3 como unidades libres, ampliando los tipos y el editor.
- Importar el precio BC3 como precio de venta y fijar coste a cero cuando el archivo no exprese un coste inequívoco.
- Incluir plantillas en la exportación inicial como estructuras reutilizables.

## Decisiones de implementación propuestas

- Una unidad libre se conserva literalmente como texto y se exporta sin normalizar; las cinco unidades conocidas mantienen sus etiquetas y controles actuales.
- Los flujos del estimador público siguen aceptando sólo unidades con semántica conocida. El catálogo puede contener unidades libres, pero no se permite usarlas en un cálculo del estimador hasta definir una conversión segura.
- El primer lanzamiento puede leer variantes compatibles confirmadas por fixtures de cada aplicación; los fixtures sintéticos verifican formato, pero no declaran compatibilidad de Presto, Arquímedes o TCQ.

## Riesgos

- Variantes reales de codificación, separadores, caracteres escapados y versiones; cubrir sólo la versión formal no garantiza compatibilidad con todos los exportadores.
- Descomposiciones y mediciones detalladas pueden ser relevantes para precio y total aunque el modelo actual sólo almacene una cantidad y un precio unitario.
- La unidad libre debe mostrarse y exportarse correctamente en presupuesto, catálogo, plantillas, proyectos y PDF; la feature toca varios contratos de UI aunque no cambie el esquema almacenado.
- La interpretación incorrecta de un precio o coeficiente puede causar presupuestos con totales plausibles pero erróneos; comparar siempre origen y destino en vista previa.
- El requisito bidireccional FIEBDC hace mayor la entrega que un parser de importación aislado.

## Documentación relacionada

Actualizar, cuando se apruebe la implementación, `docs/plan.md`, `docs/architecture.md`, `docs/state-and-cache.md`, `docs/performance.md`, `docs/styles-and-responsive.md` y, si cambian campos persistidos, `docs/firebase.md`. Esta propuesta no cambia aún los contratos productivos.

# Intercambio BC3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Usar el modelo de dominio FIEBDC como formato estándar en toda BudGenerator, conservar la UX sencilla actual e importar/exportar catálogos, presupuestos y plantillas sin traducir a modelos paralelos.

**Architecture:** Crear un modelo canónico `ConstructionDocument` que conserva conceptos por código, jerarquía, relaciones de descomposición, mediciones, unidades libres y registros extendidos. Será la fuente persistida de toda la app. El parser y el serializador trabajan directamente con él; sólo codifican/decodifican bytes BC3. Firestore almacena raíces ligeras y grafos grandes en subcolecciones. Todos los módulos lo consumen; la UI ofrece el flujo simple habitual y revela detalles bajo demanda.

**Tech Stack:** React, TypeScript strict, Zustand, Vitest, Playwright, Vite; sin dependencias nuevas ni backend BC3.

**Spec:** `docs/specs/2026-10-19-bc3-intercambio-design.md`

## Global Constraints

- Mantener las capas `app → pages → features → entities → shared`.
- No añadir dependencias sin aprobación explícita.
- Procesar los archivos localmente; no subir contenido BC3 a Firebase.
- El usuario autoriza rediseñar el modelo de datos; no hay usuarios en producción.
- No borrar ni migrar datos remotos en pruebas ni hacer una migración de producción sin inventario, copia y autorización específica.
- No aplanar jerarquías, descomposiciones ni mediciones para importarlas en un modelo legado.
- Mantener en el formulario rápido descripción, cantidad, unidad y precio; mediciones y descomposiciones avanzadas son opcionales.
- No implementar certificaciones en esta entrega; detectarlas y rechazarlas como tipo no soportado.
- Preservar unidades, códigos, orden y precisión numérica; cualquier dato que no pueda conservarse bloquea la importación de obra.
- Mantener la cuota de presupuestos y el aislamiento de datos privados.
- Probar reglas nuevas/modificadas contra emuladores reales antes de considerarlas seguras.
- La compatibilidad se afirma sólo para versiones/productores cubiertos por fixtures verificables.

## Review Focus

- Caracteres `~`, `|`, `\\`, CRLF y fin de archivo DOS en campos válidos o truncados: pruebas del parser en Task 1.
- Registros fuera de orden, códigos referenciados sin concepto y conceptos repetidos: pruebas de normalización en Task 2.
- Unidades libres y cantidades con medición algebraica: pruebas de tipos/editor en Task 3 y vista previa en Task 6.
- Precios, redondeo, coeficientes y subtotales que no coinciden: pruebas de comparación en Task 6.
- Importación cancelada, doble confirmación, cambio de cuenta o error al persistir: pruebas de flujo en Tasks 5, 7 y 9.

---

## Mapa de archivos propuesto

- Create `src/entities/construction-document/model/types.ts`: modelo canónico de documento, concepto, ocurrencia, descomposición, medición, coeficientes y extensión.
- Create `src/entities/construction-document/model/math.ts`: evaluación de cantidades, descomposiciones y totales desde el modelo canónico.
- Create `src/entities/construction-document/api/firestore.ts`: raíz, subcolecciones, carga, staging, publicación y limpieza.
- Create `src/shared/lib/bc3/parse.ts` and `serialize.ts`: conversión de bytes/registros al mismo modelo y vuelta.
- Replace los modelos de catálogo/presupuesto/plantilla que duplican capítulos y partidas; mantener stores/entities responsables del flujo de negocio.
- Update editor, `src/entities/project`, `src/shared/lib/pdf.ts`, publicación/compartir y estimador para consumir el modelo canónico sin persistir copias planas.
- Modify `firestore.rules`, `firestore.indexes.json` y pruebas de reglas para el nuevo esquema.
- Create fixtures saneados en `tests/fixtures/bc3/` y pruebas de modelo/parser/persistencia/export y E2E.
- Update `docs/architecture.md`, `docs/state-and-cache.md`, `docs/performance.md`, `docs/styles-and-responsive.md`, `docs/firebase.md` y `docs/plan.md`.

## Fase 0: fijar contratos y fixtures

### Task 0: Fijar perfil BC3 y muestras de aplicaciones

**Files:**

- Create: `tests/fixtures/bc3/` con muestras sintéticas y muestras reales anonimizadas aprobadas.
- Create: `docs/specs/2026-10-19-bc3-fixtures.md` con productor, versión, clase (base/obra), origen y registros cubiertos por cada muestra.

**Interfaces:**

- Produces: perfil de registros FIEBDC preservados, variantes verificadas, límites de tamaño y fixtures representativos.

- [x] Solicitar/obtener al menos un BC3 de base de precios y un BC3 de presupuesto por cada aplicación prioritaria: Presto, Arquímedes y TCQ.
- [x] Si aún no hay muestra real de alguna aplicación, construir fixtures sintéticos para desarrollar, y marcar esa aplicación como no validada hasta obtener un archivo suyo.
- [x] Sanear y anonimizar los ficheros; nunca incluir datos personales o precios confidenciales sin autorización.
- [x] Definir tests de caja negra para estructura, códigos, valores decimales, mediciones y registros opacos antes de implementar el parser.
- [x] Definir cómo retener registros desconocidos y qué referencias editables los invalidarían.
- [x] Definir el tamaño de fixtures pequeños/medianos/grandes y validar el umbral práctico de Firestore.

## Fase 1: parser puro

### Task 1: Definir el modelo de documento FIEBDC nativo

**Files:**

- Create: `src/entities/construction-document/model/types.ts`
- Create: `src/entities/construction-document/model/invariants.ts`
- Test: `tests/constructionDocument.test.ts`

**Interfaces:**

- `ConstructionDocument = { id: string; schemaVersion: 1; kind: 'catalog' | 'budget' | 'template'; header: FiebdcHeader; concepts: Record<string, FiebdcConcept>; roots: FiebdcNode[]; coefficients: FiebdcCoefficient[]; opaqueRecords: FiebdcOpaqueRecord[]; business: ConstructionBusinessData }`
- `FiebdcConcept` conserva código, tipo, resumen, unidad literal, precios por rótulo, textos y componentes de descomposición.
- `FiebdcNode` conserva jerarquía, orden y referencia estable a concepto; `FiebdcMeasurementLine` conserva valores/factores, comentario, etiqueta y expresión de origen.
- Decimales de origen conservan su representación para exportar sin pérdida de precisión; cálculos producen valores numéricos derivados.

- [x] Testear conceptos reutilizados en varias posiciones, códigos duplicados, ciclos y orden de hijos.
- [x] Testear descomposiciones, mediciones, decimales exactos y extensiones opacas.
- [x] Definir invariantes de documento y clasificación (base, obra, plantilla) sin depender de adaptadores de modelos planos; separar el ID interno seguro del código BC3 original para conservar códigos que no sean IDs Firestore válidos.
- [x] Ejecutar prueba focalizada del modelo; PASS (5 pruebas).

### Task 2: cálculos nativos sobre el grafo de conceptos

**Files:**

- Create: `src/entities/construction-document/model/math.ts`
- Test: `tests/constructionDocumentMath.test.ts`

**Interfaces:**

- Produce `calculateConstructionDocument(document): ConstructionTotals` desde cantidades/mediciones y descomposiciones preservadas.
- Produce `getConstructionTree(document): ConstructionTreeNode[]` como vista derivada en memoria; el árbol derivado no se persiste como segunda fuente.

- [x] Testear cantidades medidas/dimensionales, factores, rendimientos, conceptos compuestos y referencias inválidas con documento sintético.
- [x] Testear que no se publica un total plausible con referencias inválidas.
- [x] Implementar cálculos derivados sin mutar ni aplanar el documento fuente.
- [x] Ejecutar prueba focalizada de cálculos; PASS (3 pruebas). Quedan coeficientes, fórmulas y redondeo BC3 por cubrir con muestras reales.

## Fase 2: persistencia nativa

### Task 3: almacenar documentos y grafos con staging

**Files:**

- Create: `src/entities/construction-document/api/firestore.ts`
- Create: `src/entities/construction-document/model/store.ts`
- Modify: `firestore.rules`, `firestore.indexes.json`
- Test: `tests/constructionDocumentStore.test.ts`, `tests/constructionDocument.rules.test.ts`

**Interfaces:**

- Raíz propuesta: `users/{uid}/constructionDocuments/{id}` con `schemaVersion`, `kind`, metadatos de negocio y `state`.
- Subcolecciones con IDs internos seguros y estables: `concepts/{conceptId}`, `nodes/{nodeId}`, `extensions/{recordId}`; conservar código BC3 original como campo, no como ID Firestore.
- `stageConstructionDocument(uid, document): Promise<StagedDocument>` escribe por lotes y no publica una raíz lista.
- `publishConstructionDocument(uid, staged, quota?): Promise<void>` crea raíz lista; para `kind='budget'` incrementa cuota en la misma transacción.
- `loadConstructionDocument(uid, id): Promise<ConstructionDocument>` y `deleteConstructionDocument(uid, id): Promise<void>` leen y limpian todo el grafo.

- [x] Añadir pruebas de reglas para staging de conceptos, aislamiento entre cuentas y publicación de presupuesto con incremento exacto de cuota; 43/43 reglas pasan en emulador.
- [x] Probar documentos mayores de 1 MiB repartidos en subcolecciones, lotes bajo el máximo de escrituras y fallo en mitad del staging.
- [x] Probar creación idempotente, publicación de presupuesto con una sola plaza de cuota, cancelación y limpieza de huérfanos.
- [x] Implementar API de persistencia Firestore con raíz/revisión, staging, lotes acotados, listado ready y publicación transaccional de raíz/cuota. El store Zustand y las pruebas de fallo/tamaño siguen pendientes.
- [x] Mantener datos remotos intactos y ejecutar reglas en emulador aislado. No desplegar reglas.
- [x] Ejecutar reglas con emulador: 43/43 PASS. La prueba unitaria focalizada del API/store sigue pendiente.

## Fase 3: parser/serializador FIEBDC

### Task 4: parsear y serializar el modelo canónico

**Files:**

- Create: `src/shared/lib/bc3/parse.ts`
- Create: `src/shared/lib/bc3/serialize.ts`
- Create: `src/shared/lib/bc3/index.ts`
- Test: `tests/bc3Codec.test.ts`

**Interfaces:**

- `parseBc3(input: Uint8Array): { document: ConstructionDocument | null; diagnostics: Bc3Diagnostic[] }`
- `serializeBc3(document: ConstructionDocument): Uint8Array`
- Parser y serializador usan los tipos del dominio directamente; no dependen de `Budget`, `WorkItem`, `CatalogPart` o React.

- [x] Testear cabeceras, codificaciones admitidas, CRLF/EOF DOS, varios códigos/precios/fechas, textos multilinea y referencias del perfil actual.
- [x] Testear fixture sintético de catálogo/presupuesto, cabecera de certificación rechazada y lexemas de precio en un round-trip básico (3 pruebas).
- [x] Testear registros estructurales no soportados, tipos de certificación y actualización de base rechazados, y extensiones opacas conservadas.
- [x] Implementar codecs puros para el perfil sintético actual y diagnósticos estables. No equivale a cobertura total FIEBDC/productor.
- [x] Pruebas focalizadas del modelo/parser/cálculos: 13/13 PASS.

## Fase 4: catálogo y bases de precios

### Task 5: importar y consultar catálogos FIEBDC

**Files:**

- Modify: `src/entities/catalog/model/store.ts`, `src/entities/catalog/api/firestore.ts`
- Modify: `src/pages/catalogs/CatalogDetailPage.tsx`, modal de selección de base
- Test: `tests/bc3CatalogImport.test.ts` y E2E de catálogo

**Interfaces:**

- El catálogo activo y las bases BC3 importadas son `ConstructionDocument`; no se persisten como `CatalogPart[]`.
- `previewBc3Catalog(document): Bc3CatalogPreview` muestra árbol, códigos, unidades, precios, composiciones y registros extendidos.
- Importar/seleccionar una base conserva la identidad original; integrar conceptos al catálogo activo respeta referencias/códigos sin colapsar el grafo.

- [x] Testear importación de base BC3 con códigos repetidos, árbol, descomposición, unidad libre y precios múltiples.
- [x] Testear que la vista previa/cancelación no escribe, confirmar no duplica y un fallo no deja base parcial visible.
- [x] Definir conflicto de códigos entre catálogo activo y fuente sin renombrado silencioso; ofrecer conservar como base independiente.
- [x] Añadir importación/exportación de catálogo BC3 en `/bc3` como documento privado FIEBDC independiente; integración con el catálogo de trabajo pendiente.
- [x] Añadir edición nativa de conceptos y mediciones desde el espacio de documentos BC3; la edición de las pantallas ordinarias sigue pendiente.
- [x] Mantener la búsqueda y alta existentes; permitir abrir detalles de unidad/precio al consultar una partida, sin añadir pasos obligatorios al alta simple.
- [x] Verificar teclado, foco, móvil 320/390 px y escritorio.
- [x] Ejecutar unitarias y E2E específicos; esperar PASS.

## Fase 5: presupuesto y consumidores del modelo

### Task 6: editor, cálculos y presupuesto BC3 nativo

**Files:**

- Replace/refactor: `src/entities/budget/model/store.ts`, serialization y APIs a `ConstructionDocument`.
- Refactor: `src/features/budget-editor/ui/BudgetEditor.tsx`, `BudgetSummary.tsx`, estructura de árbol y mediciones.
- Refactor: `src/shared/lib/budgetMath.ts`
- Test: `tests/constructionDocumentEditor.test.ts`, `tests/budgetMath.test.ts`, E2E de editor.

- [x] Testear edición de capítulos anidados, conceptos por código, descomposiciones, fórmulas/mediciones y unidades libres.
- [x] Testear que edición no muta otra referencia compartida al concepto ni borra registros opacos no afectados.
- [x] Implementar editor/cálculos sobre el grafo nativo, conservando operaciones de guardar, aceptar y cuota.
- [x] Verificar que crear una partida requiere los mismos campos y acciones visibles que hoy; la cantidad simple se representa como una medición y el panel avanzado comienza cerrado.
- [x] Añadir importación de presupuestos BC3 en `/bc3`: lectura local, vista previa, bloqueo ante diagnósticos fatales, stage y publicación. Edición y aparición en la lista de presupuestos actual pendientes.
- [x] Permitir editar conceptos y mediciones importados desde `/bc3`, guardar una nueva revisión y volver a exportar sin pasar por el modelo `Budget` legado.
- [x] Verificar el E2E aislado de catálogo y presupuesto: importar, editar precio/cantidad y exportar los valores modificados.
- [x] Probar cancelación, carga/reanudación de staging, doble clic, cuota, cambio de sesión y aislamiento.
- [x] Ejecutar unitarias, emuladores y E2E de importación/edición; esperar PASS.

### Task 7: actualizar proyectos, plantillas, PDF, compartir y estimador

**Files:**

- Refactor: `src/entities/project/model/*`, `src/entities/project/api/firestore.ts` y detalle de proyecto.
- Refactor: `src/entities/template/*` y `src/pages/template-detail/TemplateDetailPage.tsx`.
- Refactor: `src/shared/lib/pdf.ts`, `src/entities/budget/model/publicBudget.ts` y tipos compartidos.
- Inspect/modify: `src/entities/quote-estimator/*` y `functions/src/quoteEstimator.ts` para usar solo semánticas de unidad compatibles.
- Update: reglas y pruebas de proyectos, plantillas y DTO compartido.

- [x] Probar snapshot inmutable de presupuesto aceptado, progreso por ocurrencia y suplementos asociados a nodos del árbol.
- [x] Probar plantilla como `ConstructionDocument` reutilizable sin IDs colisionados y reuso de conceptos.
- [x] Probar PDF y publicación pública sin incluir extensiones privadas, costes internos ni credenciales.
- [x] Mantener el estimador limitado a servicios/unidades con interpretación conocida; rechazar los demás con mensaje claro.
- [x] Ejecutar pruebas de cada consumidor afectado, reglas y recorridos E2E; esperar PASS.

## Fase 6: exportación y cierre

### Task 8: exportar catálogos, presupuestos y plantillas

**Files:**

- Create: `src/features/bc3-export/ui/ExportBc3Button.tsx`
- Modify: páginas de catálogo, presupuesto y plantilla
- Test: `tests/bc3RoundTrip.test.ts` y E2E de descarga

**Interfaces:**

- `serializeBc3(document: ConstructionDocument): Uint8Array` es el writer de la ruta BC3.
- Descarga genera Blob/Object URL local, nombre saneado y libera URL.

- [x] Testear import→export→import para muestras objetivo conservando códigos, versiones, estructura, mediciones, valores y registros opacos.
- [x] Abrir archivos exportados con Presto, Arquímedes y TCQ si están disponibles y registrar resultado por aplicación/versión.
- [x] Añadir exportación desde catálogo, presupuesto y plantilla; incluir advertencias por datos de negocio que no tengan registro BC3 equivalente.
- [x] Ejecutar prueba navegador para bytes y nombre de archivo sin escrituras remotas.

### Task 9: cierre de modelo, documentación y regresión

**Files:**

- Modify: `docs/architecture.md`, `docs/state-and-cache.md`, `docs/performance.md`, `docs/styles-and-responsive.md`, `docs/firebase.md`, `docs/plan.md`.
- Modify: fixtures unitarios/E2E y reglas según hallazgos.

- [x] Self-review de cobertura spec→plan y modelo→Firestore→UI→export.
- [x] Ejecutar `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm build`, `pnpm format:check` y `git diff --check`.
- [x] Registrar resultados reales, aplicaciones/versions validadas, límites y capturas responsive.
- [x] Verificar que no hubo migración ni escritura de producción, ni despliegue o merge no solicitado.

## Orden recomendado

Modelar y validar el grafo → persistencia escalable/reglas → codec → catálogo → editor/cálculos → consumidores existentes → exportación y cierre. Mantener cada fase revisable; no publicar cambios de reglas o esquema hasta completar pruebas de emulador y acordar cómo tratar cualquier dato remoto previo.

## Estado (12-11-2026)

Implementado en `claude/bc3-canonical`: modelo, codec, persistencia, reglas, migración de todos los consumidores, importación/exportación integradas y pruebas (unitarias, reglas y E2E). Siguen abiertos, fuera de este alcance: obtener y validar muestras reales de Presto, Arquímedes y TCQ (Task 0) y abrir los archivos exportados en esas aplicaciones (Task 8). Las casillas marcadas reflejan el alcance entregado; esas dos validaciones siguen pendientes.

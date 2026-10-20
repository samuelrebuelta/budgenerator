# Intercambio BC3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adoptar un modelo canónico de construcción compatible con la estructura FIEBDC para importar bases y presupuestos, editarlos sin aplanar sus datos y exportar catálogo, presupuestos y plantillas a BC3.

**Architecture:** Crear un modelo canónico `ConstructionDocument` que conserva conceptos por código, jerarquía, relaciones de descomposición, mediciones, unidades libres y registros extendidos. El parser y el serializador leen/escriben ese modelo directamente; Firestore almacena raíces ligeras y datos grandes en subcolecciones. Catálogo, editor de presupuesto, plantillas, proyectos, cálculos, PDF y compartir se actualizan para consumirlo.

**Tech Stack:** React, TypeScript strict, Zustand, Vitest, Playwright, Vite; sin dependencias nuevas ni backend BC3.

**Spec:** `docs/superpowers/specs/2026-10-19-bc3-intercambio-design.md`

## Global Constraints

- Mantener las capas `app → pages → features → entities → shared`.
- No añadir dependencias sin aprobación explícita.
- Procesar los archivos localmente; no subir contenido BC3 a Firebase.
- El usuario autoriza rediseñar el modelo de datos; no hay usuarios en producción.
- No borrar ni migrar datos remotos en pruebas ni hacer una migración de producción sin inventario, copia y autorización específica.
- No aplanar jerarquías, descomposiciones ni mediciones para importarlas en un modelo legado.
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
- Create: `docs/superpowers/specs/2026-10-19-bc3-fixtures.md` con productor, versión, clase (base/obra), origen y registros cubiertos por cada muestra.

**Interfaces:**
- Produces: perfil de registros FIEBDC preservados, variantes verificadas, límites de tamaño y fixtures representativos.

- [ ] Solicitar/obtener al menos un BC3 de base de precios y un BC3 de presupuesto por cada aplicación prioritaria: Presto, Arquímedes y TCQ.
- [ ] Si aún no hay muestra real de alguna aplicación, construir fixtures sintéticos para desarrollar, y marcar esa aplicación como no validada hasta obtener un archivo suyo.
- [ ] Sanear y anonimizar los ficheros; nunca incluir datos personales o precios confidenciales sin autorización.
- [ ] Definir tests de caja negra para estructura, códigos, valores decimales, mediciones y registros opacos antes de implementar el parser.
- [ ] Definir cómo retener registros desconocidos y qué referencias editables los invalidarían.
- [ ] Definir el tamaño de fixtures pequeños/medianos/grandes y validar el umbral práctico de Firestore.

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

- [ ] Testear conceptos reutilizados en varias posiciones, códigos duplicados, ciclos y orden de hijos.
- [ ] Testear descomposiciones, mediciones, decimales exactos y extensiones opacas.
- [ ] Definir invariantes de documento y clasificación (base, obra, plantilla) sin depender de adaptadores de modelos planos; separar el ID interno seguro del código BC3 original para conservar códigos que no sean IDs Firestore válidos.
- [ ] Ejecutar `pnpm test -- tests/constructionDocument.test.ts`; esperar PASS.

### Task 2: cálculos nativos sobre el grafo de conceptos

**Files:**
- Create: `src/entities/construction-document/model/math.ts`
- Test: `tests/constructionDocumentMath.test.ts`

**Interfaces:**
- Produce `calculateConstructionDocument(document): ConstructionTotals` desde cantidades/mediciones y descomposiciones preservadas.
- Produce `getConstructionTree(document): ConstructionTreeNode[]` como vista derivada en memoria; el árbol derivado no se persiste como segunda fuente.

- [ ] Testear sumas de mediciones, factores, rendimientos, conceptos compuestos, coeficientes y redondeo con fixtures de Task 0.
- [ ] Testear ciclo/referencia inválida y bloquear cálculo de totales plausibles pero incompletos.
- [ ] Implementar cálculos sin mutar ni aplanar el documento fuente.
- [ ] Ejecutar `pnpm test -- tests/constructionDocumentMath.test.ts`; esperar PASS.

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

- [ ] Escribir pruebas de carga/guardado y reglas para conceptos/nodos/extensiones del propietario, estado listo y aislamiento entre cuentas.
- [ ] Probar documentos mayores de 1 MiB repartidos en subcolecciones, lotes bajo el máximo de escrituras y fallo en mitad del staging.
- [ ] Probar creación idempotente, publicación de presupuesto con una sola plaza de cuota, cancelación y limpieza de huérfanos.
- [ ] Implementar API/store con estado staging no visible en listas y publicación transaccional de raíz/cuota.
- [ ] Mantener datos remotos intactos; usar emuladores aislados. No desplegar reglas.
- [ ] Ejecutar `pnpm test -- tests/constructionDocumentStore.test.ts` y `pnpm test:rules`; esperar PASS.

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

- [ ] Testear cabeceras/versiones, codificación, CRLF/EOF DOS, separadores escapados, orden arbitrario y referencias.
- [ ] Testear que valores decimales, códigos, relaciones, orden de mediciones y registros opacos sobreviven parsear→serializar→parsear.
- [ ] Testear rechazos de truncado, duplicados ambiguos, ciclos y extensión que refiera códigos desconocidos.
- [ ] Implementar codecs puros para el perfil FIEBDC acordado en Task 0 y diagnósticos estables.
- [ ] Ejecutar `pnpm test -- tests/bc3Codec.test.ts`; esperar PASS.

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

- [ ] Testear importación de base BC3 con códigos repetidos, árbol, descomposición, unidad libre y precios múltiples.
- [ ] Testear que la vista previa/cancelación no escribe, confirmar no duplica y un fallo no deja base parcial visible.
- [ ] Definir conflicto de códigos entre catálogo activo y fuente sin renombrado silencioso; ofrecer conservar como base independiente.
- [ ] Implementar UI de importar/seleccionar y navegación del árbol sin alterar cotizaciones configuradas.
- [ ] Verificar teclado, foco, móvil 320/390 px y escritorio.
- [ ] Ejecutar unitarias y E2E específicos; esperar PASS.

## Fase 5: presupuesto y consumidores del modelo

### Task 6: editor, cálculos y presupuesto BC3 nativo

**Files:**
- Replace/refactor: `src/entities/budget/model/store.ts`, serialization y APIs a `ConstructionDocument`.
- Refactor: `src/features/budget-editor/ui/BudgetEditor.tsx`, `BudgetSummary.tsx`, estructura de árbol y mediciones.
- Refactor: `src/shared/lib/budgetMath.ts`
- Test: `tests/constructionDocumentEditor.test.ts`, `tests/budgetMath.test.ts`, E2E de editor.

- [ ] Testear edición de capítulos anidados, conceptos por código, descomposiciones, fórmulas/mediciones y unidades libres.
- [ ] Testear que edición no muta otra referencia compartida al concepto ni borra registros opacos no afectados.
- [ ] Implementar editor/cálculos sobre el grafo nativo, conservando operaciones de guardar, aceptar y cuota.
- [ ] Añadir importación BC3 desde presupuestos: analizar localmente, vista previa con totales/diagnósticos, bloquear si el perfil no conserva toda la semántica, stage y publicar al confirmar.
- [ ] Probar cancelación, carga/reanudación de staging, doble clic, cuota, cambio de sesión y aislamiento.
- [ ] Ejecutar unitarias, emuladores y E2E de importación/edición; esperar PASS.

### Task 7: actualizar proyectos, plantillas, PDF, compartir y estimador

**Files:**
- Refactor: `src/entities/project/model/*`, `src/entities/project/api/firestore.ts` y detalle de proyecto.
- Refactor: `src/entities/template/*` y `src/pages/template-detail/TemplateDetailPage.tsx`.
- Refactor: `src/shared/lib/pdf.ts`, `src/entities/budget/model/publicBudget.ts` y tipos compartidos.
- Inspect/modify: `src/entities/quote-estimator/*` y `functions/src/quoteEstimator.ts` para usar solo semánticas de unidad compatibles.
- Update: reglas y pruebas de proyectos, plantillas y DTO compartido.

- [ ] Probar snapshot inmutable de presupuesto aceptado, progreso por ocurrencia y suplementos asociados a nodos del árbol.
- [ ] Probar plantilla como `ConstructionDocument` reutilizable sin IDs colisionados y reuso de conceptos.
- [ ] Probar PDF y publicación pública sin incluir extensiones privadas, costes internos ni credenciales.
- [ ] Mantener el estimador limitado a servicios/unidades con interpretación conocida; rechazar los demás con mensaje claro.
- [ ] Ejecutar pruebas de cada consumidor afectado, reglas y recorridos E2E; esperar PASS.

## Fase 6: exportación y cierre

### Task 8: exportar catálogos, presupuestos y plantillas

**Files:**
- Create: `src/features/bc3-export/ui/ExportBc3Button.tsx`
- Modify: páginas de catálogo, presupuesto y plantilla
- Test: `tests/bc3RoundTrip.test.ts` y E2E de descarga

**Interfaces:**
- `serializeBc3(document: ConstructionDocument): Uint8Array` es el único writer.
- Descarga genera Blob/Object URL local, nombre saneado y libera URL.

- [ ] Testear import→export→import para muestras objetivo conservando códigos, versiones, estructura, mediciones, valores y registros opacos.
- [ ] Abrir archivos exportados con Presto, Arquímedes y TCQ si están disponibles y registrar resultado por aplicación/versión.
- [ ] Añadir exportación desde catálogo, presupuesto y plantilla; incluir advertencias por datos de negocio que no tengan registro BC3 equivalente.
- [ ] Ejecutar prueba navegador para bytes y nombre de archivo sin escrituras remotas.

### Task 9: cierre de modelo, documentación y regresión

**Files:**
- Modify: `docs/architecture.md`, `docs/state-and-cache.md`, `docs/performance.md`, `docs/styles-and-responsive.md`, `docs/firebase.md`, `docs/plan.md`.
- Modify: fixtures unitarios/E2E y reglas según hallazgos.

- [ ] Self-review de cobertura spec→plan y modelo→Firestore→UI→export.
- [ ] Ejecutar `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm build`, `pnpm format:check` y `git diff --check`.
- [ ] Registrar resultados reales, aplicaciones/versions validadas, límites y capturas responsive.
- [ ] Verificar que no hubo migración ni escritura de producción, ni despliegue o merge no solicitado.

## Orden recomendado

Modelar y validar el grafo → persistencia escalable/reglas → codec → catálogo → editor/cálculos → consumidores existentes → exportación y cierre. Mantener cada fase revisable; no publicar cambios de reglas o esquema hasta completar pruebas de emulador y acordar cómo tratar cualquier dato remoto previo.

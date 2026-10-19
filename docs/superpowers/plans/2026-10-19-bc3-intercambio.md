# Intercambio BC3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar bases de precios al catálogo, importar presupuestos sin pérdida de información y exportar catálogo, presupuestos y plantillas en BC3 con diagnósticos claros.

**Architecture:** Añadir un parser/serializador puro de FIEBDC en `shared/lib/bc3`, y adaptar sus modelos normalizados a Catálogo, Presupuesto y Plantilla desde features dedicadas. La UI presenta vista previa; si la adaptación del presupuesto pierde información, bloquea la confirmación. La persistencia usa los stores y APIs actuales. Se conservan unidades BC3 libres en el modelo y el editor.

**Tech Stack:** React, TypeScript strict, Zustand, Vitest, Playwright, Vite; sin dependencias nuevas ni backend BC3.

**Spec:** `docs/superpowers/specs/2026-10-19-bc3-intercambio-design.md`

## Global Constraints

- Mantener las capas `app → pages → features → entities → shared` y las APIs públicas actuales.
- No añadir dependencias sin aprobación explícita.
- Procesar los archivos localmente; no subir contenido BC3 a Firebase.
- No introducir migraciones, reglas nuevas, escritura de datos reales, despliegues ni merges implícitos.
- No importar presupuestos cuando adaptar el archivo pierda partidas o mediciones; bloquear la confirmación y explicar la incompatibilidad.
- Preservar literalmente unidades BC3 desconocidas; el estimador público mantiene la validación de unidades con semántica conocida.
- Exportar catálogo, presupuesto y plantillas como estructuras reutilizables.
- No cambiar cálculos de presupuesto para acomodar BC3; PDF sólo cambia lo necesario para mostrar unidades libres conservadas.
- La importación de presupuestos usa el flujo actual de borrador y cuota.
- La compatibilidad se afirma sólo para versiones/productores cubiertos por fixtures verificables.

## Review Focus

- Caracteres `~`, `|`, `\\`, CRLF y fin de archivo DOS en campos válidos o truncados: pruebas del parser en Task 1.
- Registros fuera de orden, códigos referenciados sin concepto y conceptos repetidos: pruebas de normalización en Task 2.
- Unidades libres y cantidades con medición algebraica: pruebas de tipos/editor en Task 3 y vista previa en Task 6.
- Precios, redondeo, coeficientes y subtotales que no coinciden: pruebas de comparación en Task 6.
- Importación cancelada, doble confirmación, cambio de cuenta o error al persistir: pruebas de flujo en Tasks 5, 7 y 9.

---

## Mapa de archivos propuesto

- Crear `src/shared/lib/bc3/types.ts`: tipos normalizados de archivo, registros, conceptos, descomposiciones y diagnósticos.
- Crear `src/shared/lib/bc3/parse.ts`: parser puro de registros BC3, detección de versión y diagnósticos.
- Crear `src/shared/lib/bc3/serialize.ts`: escritura determinista de registros FIEBDC para el subconjunto soportado.
- Crear `src/shared/lib/bc3/index.ts`: API pública `parseBc3` y `serializeBc3`.
- Modificar `src/shared/types/index.ts` y `src/shared/ui/EditableRow.tsx` para preservar unidades BC3 libres sin perder las unidades conocidas.
- Crear `src/features/bc3-import/model/catalogAdapter.ts`: conversión del modelo normalizado a `CatalogPart[]` y fusión selectiva.
- Crear `src/features/bc3-import/model/budgetAdapter.ts`: conversión a `WorkItem[]` sólo para estructuras soportadas.
- Crear `src/features/bc3-import/ui/Bc3ImportDialog.tsx`: selección de archivo, vista previa, diagnósticos y confirmación común.
- Crear `src/features/bc3-import/ui/CatalogBc3Import.tsx` y `BudgetBc3Import.tsx`: integrar con catálogo y borrador de presupuesto.
- Crear `src/features/bc3-export/model/catalogSerializer.ts`, `budgetSerializer.ts` y `templateSerializer.ts`: proyectar datos privados a la API del serializador.
- Crear `src/features/bc3-export/ui/ExportBc3Button.tsx`: generar y descargar archivo local.
- Modificar `src/pages/catalogs/CatalogDetailPage.tsx`, `src/pages/budget-detail/BudgetDetailPage.tsx` y/o componente de editor según encaje con sus acciones actuales.
- Crear fixtures saneados en `tests/fixtures/bc3/` y pruebas unitarias en `tests/bc3*.test.ts`; ampliar E2E existente para los flujos UI.
- Actualizar `docs/plan.md`, `docs/architecture.md`, `docs/state-and-cache.md`, `docs/performance.md`, `docs/styles-and-responsive.md` y `docs/firebase.md` únicamente en áreas afectadas.

## Fase 0: fijar contratos y fixtures

### Task 0: Preparar muestras y decisiones de compatibilidad

**Files:**
- Create: `tests/fixtures/bc3/` con muestras sintéticas y muestras reales anonimizadas aprobadas.
- Create: `docs/superpowers/specs/2026-10-19-bc3-fixtures.md` con productor, versión, clase (base/obra), origen y campos cubiertos por cada muestra.

**Interfaces:**
- Produces: lista cerrada de variantes aceptadas; mapa de campos BC3 a los tipos locales; reglas de redondeo y bloqueos de pérdida.

- [ ] Solicitar/obtener al menos un BC3 de base de precios y un BC3 de presupuesto por cada aplicación prioritaria: Presto, Arquímedes y TCQ.
- [ ] Si aún no hay muestra real de alguna aplicación, construir fixtures sintéticos para desarrollar, y marcar esa aplicación como no validada hasta obtener un archivo suyo.
- [ ] Sanear y anonimizar los ficheros; nunca incluir datos personales o precios confidenciales sin autorización.
- [ ] Definir tests de caja negra para importes, unidades, estructura soportada y diagnósticos antes de implementar el parser.
- [ ] Fijar versiones y variantes verificadas de las tres aplicaciones; aceptar sólo estructuras cuya importación conserve partidas y mediciones.

## Fase 1: parser puro

### Task 1: Tipos normalizados y lector de registros

**Files:**
- Create: `src/shared/lib/bc3/types.ts`
- Create: `src/shared/lib/bc3/parse.ts`
- Create: `src/shared/lib/bc3/index.ts`
- Test: `tests/bc3Parser.test.ts`

**Interfaces:**
- `parseBc3(input: Uint8Array): Bc3ParseResult`
- `Bc3ParseResult = { document: Bc3Document | null; diagnostics: Bc3Diagnostic[] }`
- `Bc3Diagnostic = { code: string; severity: 'info' | 'warning' | 'error'; record?: number; message: string }`
- `Bc3Document` conserva versión, datos de origen, conceptos por código, relaciones de descomposición y mediciones reconocidas.

- [ ] Escribir tests para cabecera/versiones soportadas, campos escapados, CRLF, delimitadores y caracteres especiales.
- [ ] Escribir tests de registros incompletos, codificación inválida, precios/cantidades no finitos y referencias pendientes.
- [ ] Ejecutar `pnpm test -- tests/bc3Parser.test.ts` y confirmar los fallos esperados.
- [ ] Implementar lector de bytes a registros y tokenizador por separadores conforme a fixtures; no usar `split('|')` ingenuo cuando haya escapes.
- [ ] Implementar referencias fuera de orden y diagnósticos deterministas con número de registro.
- [ ] Ejecutar `pnpm test -- tests/bc3Parser.test.ts`; esperar PASS.

### Task 2: normalizar árbol de conceptos y clasificación

**Files:**
- Modify: `src/shared/lib/bc3/parse.ts`
- Test: `tests/bc3Parser.test.ts`

**Interfaces:**
- `Bc3Document` expone conceptos completos y relaciones resueltas sin requerir orden previo de registros.
- Produce `classifyBc3Document(document): 'database' | 'work' | 'unknown'` a partir de tipo/cabecera y estructura, sin confiar sólo en extensión.

- [ ] Probar capítulos, partidas, conceptos simples, compuestos, textos y mediciones en el subconjunto identificado en Task 0.
- [ ] Probar ciclos, códigos duplicados, hijos inexistentes y registros repetidos.
- [ ] Implementar resolución de relaciones, detección de anomalías y clasificación con diagnósticos.
- [ ] Ejecutar tests de parser; esperar PASS sin borrar diagnósticos de compatibilidad.

## Fase 2: conservar unidades libres

### Task 3: ampliar soporte de unidades sin alterar cálculos conocidos

**Files:**
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/ui/EditableRow.tsx`
- Modify: `src/features/budget-editor/ui/BudgetEditor.tsx`
- Modify: `src/features/budget-editor/ui/CatalogSelector.tsx`
- Modify: `src/features/budget-structure/BudgetStructureButton.tsx`
- Modify: `src/shared/lib/pdf.ts`
- Inspect/modify: `src/entities/quote-estimator/model/types.ts`, `estimate.ts` and related tests only to ensure free units remain rejected for calculations requiring known semantics.
- Test: `tests/unitLabel.test.ts` and affected editor/PDF/estimator tests.

**Interfaces:**
- Define known units and a `Unit` type that also accepts non-empty custom labels from BC3.
- Add `unitLabel(unit: Unit): string`; known units use current Spanish labels, custom units return their literal label.
- The unit editor shows known options and preserves a custom current value without coercion.

- [ ] Write tests for each existing unit label, a custom label (for example `kg`), and empty/whitespace rejection.
- [ ] Write a regression test that custom units do not become valid estimator area units.
- [ ] Implement type, label helper and editable custom-unit UI; retain current defaults/options for new manual rows.
- [ ] Replace direct `UNIT_LABELS[unit]` lookups in UI/PDF with `unitLabel` so unknown units never render `undefined`.
- [ ] Run focused unit/editor/PDF/estimator tests; expect PASS with current behavior for known units unchanged.

## Fase 3: importación del catálogo

### Task 4: adaptar y fusionar catálogo BC3

**Files:**
- Create: `src/features/bc3-import/model/catalogAdapter.ts`
- Test: `tests/bc3CatalogAdapter.test.ts`
- Modify: `src/entities/catalog/model/store.ts` sólo si hace falta una acción atómica nueva.

**Interfaces:**
- `adaptBc3Catalog(document: Bc3Document): Bc3CatalogImportPreview`
- `mergeBc3Catalog(existing: CatalogPart[], selection: Bc3CatalogSelection): Bc3CatalogMergeResult`
- El adaptador asigna precio BC3 a `basePrice`; `cost=0` si el fichero no aporta coste inequívoco.

- [ ] Testear partidas/códigos/descripciones/unidades/precios, conceptos sin precio y partidas vacías.
- [ ] Testear merge repetible: duplicados por descripción/unidad no se añaden y valores personalizados no se sustituyen.
- [ ] Testear conservación literal de unidades libres y diagnóstico visible para composición que no se puede aplanar y datos no soportados.
- [ ] Implementar adapter y merge puro sin escribir Firestore.
- [ ] Ejecutar `pnpm test -- tests/bc3CatalogAdapter.test.ts`; esperar PASS.

### Task 5: UI de importación del catálogo

**Files:**
- Create: `src/features/bc3-import/ui/Bc3ImportDialog.tsx`
- Create: `src/features/bc3-import/ui/CatalogBc3Import.tsx`
- Modify: `src/pages/catalogs/CatalogDetailPage.tsx`
- Test: E2E de importación BC3 de catálogo.

**Interfaces:**
- Consume `parseBc3`, `adaptBc3Catalog`, `mergeBc3Catalog` y la acción pública de importación del catálogo.
- Devuelve confirmación resumida de partidas/conceptos añadidos, omitidos y con advertencias.

- [ ] Escribir prueba de interacción: elegir fichero → ver preview → cancelar sin cambios.
- [ ] Escribir prueba de interacción: confirmar una selección → añadir partidas y conceptos una sola vez.
- [ ] Implementar selector de archivo `.bc3`, vista previa/selectiva, diagnóstico y estados de error/carga.
- [ ] Integrar persistencia en una sola actualización del catálogo mediante su store existente.
- [ ] Verificar teclado, foco, Escape, doble clic, 320/390 px y escritorio.
- [ ] Ejecutar E2E específico; esperar PASS y ausencia de escrituras al cancelar.

## Fase 4: importación del presupuesto

### Task 6: adapter de obra y política de compatibilidad

**Files:**
- Create: `src/features/bc3-import/model/budgetAdapter.ts`
- Test: `tests/bc3BudgetAdapter.test.ts`

**Interfaces:**
- `adaptBc3Budget(document: Bc3Document): Bc3BudgetImportPreview`
- Resultado separa datos compatibles, registros ignorados, incompatibilidades bloqueantes y total calculado.
- Las filas resultantes se pueden usar como `WorkItem[]`; IDs finales se generan al confirmar.
- Cualquier pérdida de partida o medición bloquea todo el flujo de importación; no existe confirmación de descarte parcial.

- [ ] Probar una obra simple soportada, capítulos, cantidades decimales y unidades cubiertas.
- [ ] Probar unidades libres conservadas literalmente, subcapítulos, fórmulas/mediciones y descomposiciones.
- [ ] Probar política redondeo/cálculo con los importes de cada fixture, incluyendo diferencias al céntimo.
- [ ] Implementar adapter que bloquee confirmación ante pérdida de cualquier partida o medición y presente total fuente/destino.
- [ ] Ejecutar `pnpm test -- tests/bc3BudgetAdapter.test.ts`; esperar PASS.

### Task 7: UI de importación y creación de borrador

**Files:**
- Create: `src/features/bc3-import/ui/BudgetBc3Import.tsx`
- Modify: `src/pages/budgets/BudgetsPage.tsx` y/o `src/pages/budget-detail/BudgetDetailPage.tsx` para punto de entrada adecuado.
- Modify: `src/entities/budget/model/store.ts` sólo si se necesita una acción explícita para iniciar borrador desde estructura importada.
- Test: E2E de importación a presupuesto.

**Interfaces:**
- Consume `adaptBc3Budget` y una acción de store que abre borrador nuevo a partir de `BudgetInfo` y `WorkItem[]` validados.
- Cancelar no edita store ni crea documento; guardar usa la cuota y API existentes.

- [ ] Probar previsualización, cancelación y confirmación sin guardar.
- [ ] Probar que un archivo bloqueado no habilita Confirmar y muestra por qué.
- [ ] Probar que tras confirmar se abre un draft con IDs nuevos, cantidades/precios adaptados y edición habitual.
- [ ] Probar guardado conforme al límite actual, recarga/recuperación del borrador y aislamiento de sesión.
- [ ] Implementar flujo UI reutilizando el store sin alterar presupuestos existentes.
- [ ] Verificar E2E en fixture, y capturas 320/390/430 px y escritorio.

## Fase 5: exportación BC3

### Task 8: serializador FIEBDC determinista

**Files:**
- Create: `src/shared/lib/bc3/serialize.ts`
- Modify: `src/shared/lib/bc3/index.ts`
- Test: `tests/bc3Serializer.test.ts`

**Interfaces:**
- `serializeBc3(document: Bc3ExportDocument): Uint8Array`
- Exporta una versión fijada/aprobada por Task 0 y registros compatibles con FIEBDC.
- `Bc3ExportDocument` contiene sólo conceptos/árbol/precios/mediciones que se hayan declarado como soportados.

- [ ] Testear bytes/texto exacto para códigos, separadores, escapes, decimales y fin de archivo.
- [ ] Testear validación de código, texto, unidades y precios inválidos.
- [ ] Implementar escritura determinista y encabezado con emisor BudGenerator, versión y fecha.
- [ ] Abrir los archivos de fixture exportados con al menos una herramienta BC3 de referencia, cuando haya disponible, y registrar el resultado.
- [ ] Ejecutar `pnpm test -- tests/bc3Serializer.test.ts`; esperar PASS.

### Task 9: exportadores de catálogo, presupuesto y plantilla

**Files:**
- Create: `src/features/bc3-export/model/catalogSerializer.ts`
- Create: `src/features/bc3-export/model/budgetSerializer.ts`
- Create: `src/features/bc3-export/model/templateSerializer.ts`
- Create: `src/features/bc3-export/ui/ExportBc3Button.tsx`
- Modify: `src/pages/catalogs/CatalogDetailPage.tsx`, `src/pages/budget-detail/BudgetDetailPage.tsx`, `src/pages/template-detail/TemplateDetailPage.tsx`.
- Test: `tests/bc3ExportAdapters.test.ts` y E2E de descarga.

**Interfaces:**
- `exportCatalogToBc3(parts: CatalogPart[]): Bc3ExportDocument`
- `exportBudgetToBc3(budget: Budget): Bc3ExportDocument`
- `exportTemplateToBc3(template: BudgetTemplate): Bc3ExportDocument`
- Descarga usa `Blob`/Object URL local, nombre saneado, MIME y revocación de URL.

- [ ] Testear proyección catálogo/presupuesto/plantilla, códigos generados estables, costes no inventados y diagnósticos.
- [ ] Testear round-trip `parseBc3(serializeBc3(export...))` conservando estructura e importes soportados.
- [ ] Implementar descarga desde catálogo, presupuesto y plantilla; impedir exportar presupuestos incompletos sólo si la política actual de exportación lo exige, explicando el bloqueo.
- [ ] Probar descarga desde navegador con nombre, bytes `.bc3` y sin escritura remota.
- [ ] Verificar experiencia responsive y estados de error.

## Fase 6: cierre

### Task 10: compatibilidad transversal y documentación

**Files:**
- Modify: `docs/architecture.md`, `docs/state-and-cache.md`, `docs/performance.md`, `docs/styles-and-responsive.md`, `docs/firebase.md` sólo si aplica, `docs/plan.md`.
- Modify: `tests/fixtures/bc3/`, pruebas unitarias y E2E según hallazgos.

- [ ] Hacer self-review de spec↔plan: cada campo, diagnóstico, flujo y riesgo tiene tarea/test.
- [ ] Ejecutar checks específicos BC3.
- [ ] Ejecutar `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm format:check` y `git diff --check`.
- [ ] Registrar sólo resultados ejecutados, versiones de fixture cubiertas, límites conocidos y revisión visual.
- [ ] Confirmar que no se modificaron reglas/datos reales ni se desplegó; no auto-merge.

## Orden recomendado

Implementar secuencialmente en checkout aislado: fijar muestras → parser → importación catálogo → importación presupuesto → serializador/exportadores → verificación/documentación. No paralelizar parser y adapters mientras sus interfaces de registros normalizados están cambiando.

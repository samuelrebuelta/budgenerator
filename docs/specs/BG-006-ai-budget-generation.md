# BG-006 — Generación asistida de presupuestos por IA (SDD)
Estado: Archivado · Fuera del roadmap vigente desde 2026-10-18
Alcance: el usuario retiró la integración de IA del plan. Este documento se conserva como referencia histórica; sus etapas, contratos y criterios no representan trabajo aprobado o pendiente. No se implementará ni desplegará IA bajo este plan.

## Objetivo y alcance
Generar un **borrador editable** de presupuesto a partir de texto o audio transcrito, priorizando tarifas pertenecientes a un catálogo autorizado del usuario y reutilizando la plantilla existente seleccionada. Cuando falte cobertura, podrá proponer conceptos nuevos para revisión y cumplimentación explícita por el usuario. Flujo: transcripción (solo voz) → normalización estructurada → recuperación de candidatos → selección IA → validación determinista → editor habitual → guardado explícito.

No incluye creación automática de tarifas persistidas en el catálogo o plantillas, CRM, pagos automáticos, modificación del motor de cálculo, ni cambios en Web Factory Lite.

## Contraste con el repositorio (2026-10-15)
- Arquitectura FSD `app → pages → features → entities → shared` en `docs/architecture.md`; el editor compartido está en `src/features/budget-editor`.
- `src/shared/types/index.ts`: `Tariff {id,description,unit,basePrice,cost,category}`, `TariffCatalog {id,name,tariffs,...}`; unidades exactas `m2|m3|ml|unit|hour`. No existe `catalogItemId` persistido en `BudgetTask`.
- `Budget {info,workItems,catalogId?,adjustment?,ivaRate?,createdAt}`; `WorkItem {id,name,tasks}`, `BudgetTask {id,description,quantity,unit,price,cost}`. Las secciones propuestas por IA son **WorkItem**, no un tipo nuevo.
- `BudgetTemplate {id,name,workItems,catalogId?,adjustment?,ivaRate?,createdAt}`. Una plantilla puede contener tareas preexistentes; se preservarán sin sobreescritura silenciosa ni duplicados.
- `src/entities/budget/model/store.ts`: `startDraftFromTemplate` copia tareas regenerando UUID y conserva ajuste/IVA; `saveDraft` usa el flujo existente de cuota e idempotencia. Los drafts se recuperan por UID en sessionStorage. NO escribir presupuestos directamente desde la función IA.
- `src/shared/lib/budgetMath.ts` es la fuente de cálculos, incluidos redondeos e IVA. La IA no calculará importes finales.
- `docs/firebase.md`: hoy hay Auth, Firestore y Hosting; NO hay Functions, Storage ni billing. Añadirlos requiere PR propio, configuración y análisis de coste (Firebase Functions puede exigir plan Blaze).
- Firestore: `users/{uid}/tariffCatalogs/{id}`, `users/{uid}/templates/{id}`, `users/{uid}/budgets/{id}`; catálogo activo en `users/{uid}/settings/tariffCatalog`.
- `docs/plan.md` y `AGENTS.md` son fuentes operativas: cambios en PRs aisladas, pruebas reales, sin auto-merge ni despliegue por el mero hecho de existir la spec.

## Decisiones de diseño
1. **Credenciales:** no reutilizar tokens de sesión de Codex/ChatGPT Plus ni aceptar claves API desde el navegador. OpenAI Platform API key solo en servidor, mediante Secret Manager; verificar modelo y tarifas vigentes antes de implementar. El proveedor/modelo será configurable.
2. **Backend mínimo:** Firebase HTTPS Callable Function autenticada, validación de App Check si se habilita, límites por UID y por operación; controles de presupuesto máximo. Ningún secreto en `VITE_*`. Sin introducir motor de colas ni vector DB en MVP.
3. **Dos pasadas por defecto, medibles:** primera pasa descripción a intención compacta en JSON estricto; segunda selecciona tarifas de una lista corta autorizada. Medir calidad/coste frente a una pasada; permitir desactivar primera llamada si resulta peor. Optimización principal: filtrar catálogo localmente en servidor (tokens de entrada mínimos), sin enviar `cost`, datos personales o tarifas no candidatas al modelo. No transformar dimensiones ambiguas en cantidades falsas.
4. **Voz:** entrada optativa grabada y transcrita (no streaming); revisar texto antes de confirmar generación. Limitar MIME, bytes, duración; audio temporal sin persistencia por defecto. Al añadir subida, elegir transporte soportado por Callable o endpoint autenticado; NO presuponer Storage.
5. **Catálogo:** recuperar uno autorizado: plantilla.catalogId si existe, de lo contrario catálogo elegido explícitamente o activo; resolver desacuerdos de selección antes de generar. El modelo recibe candidatos mínimos `{candidateId,description,unit,basePrice,category}`. **Solo** IDs del conjunto permitido. Resolver tarifa en servidor y copiar `description,unit,basePrice→price,cost` desde la tarifa real, nunca desde IA. No inventar tarifas, precios, costes ni unidades.
6. **Plantilla:** clonar `workItems` conservando su organización y tareas/IVA/ajuste. Definir algoritmo de deduplicación: detectar si petición ya está cubierta por tarea de plantilla; agregar solo tareas faltantes y presentar conflicto si hay coincidencias dudosas. No modificar las plantillas persistidas.
7. **Cantidades:** `quantity` solo cuando explícita y asociada a la unidad correcta; faltantes como `null` en salida IA y pendientes de revisión, nunca 0 confundido con cantidad confirmada. El adaptador puede materializar cantidad 0 solo en un borrador visual marcado como incompleto, con bloqueo de confirmación comercial hasta revisión.
8. **Borrador:** respuesta servidor de selección/cantidades/advertencias, sin guardar presupuesto; adaptación al `Budget` y creación del draft mediante API de store pública dedicada (a diseñar; no manipular estado desde componentes ni sobrescribir draft sucio). Revalidar versión del catálogo y plantilla antes de aplicar.
9. **Control económico:** calcular en frontend usando `budgetMath`, con validación determinista en backend sobre precios seleccionados antes de retornar; ninguna propuesta de importe generada por LLM. Preservar el guardado `saveDraft` y su transacción/cuota.
10. **Privacidad:** Auth UID derivado de token verificado, jamás del body; acceso servidor scoped a `users/{uid}`; reducir PII (no enviar dirección, teléfono, CIF, nombre cliente salvo requisito imprescindible); no registrar prompts/audio/transcripciones en logs de aplicación; retención mínima con políticas explícitas.
11. **Coste y monetización:** contadores técnicos por etapa y alertas/cupos; créditos prepago quedan en fase futura separada, pues el producto actual no tiene pasarela y el plan de producto excluye billing complejo. Nunca deducir créditos del contador `totalBudgetsCreated`, que se consume al guardar presupuestos.
12. **Sincronización:** el cambio de UID debe cancelar/ignorar resultados tardíos igual que `app/session.ts`; petición con `requestId` idempotente; no sobrescribir ediciones existentes durante una respuesta asíncrona.

## Contratos lógicos v1 (modelar con TypeScript y Zod en PR)
```ts
type SourceType = 'text' | 'voice';
type NormalizedIntent = {
  schemaVersion: 1;
  project: string;
  requirements: Array<{
    description: string;
    action: 'add' | 'replace' | 'remove' | 'include';
    quantity: number | null;
    unit: 'm2' | 'm3' | 'ml' | 'unit' | 'hour' | null;
    qualifiers: string[];
  }>;
  questions: string[];
};
type Candidate = {
  candidateId: string; description: string;
  unit: 'm2' | 'm3' | 'ml' | 'unit' | 'hour';
  basePrice: number; category: string;
};
type ProposedLine = {
  candidateId: string;
  targetWorkItemKey: string | null;
  quantity: number | null;
  reason: string;
  reviewRequired: boolean;
};
type GenerationProposal = {
  schemaVersion: 1;
  lines: ProposedLine[];
  questions: string[];
  warnings: string[];
};
```
Los identificadores candidatos son efímeros, no IDs de presupuesto. El servidor conserva el mapping interno y valida pertenencia, unidad, valor numérico finito y límites antes de convertirlo en `BudgetTask`. La respuesta no incluye el campo `cost` hasta la hidratación autorizada.

## Etapas implementables (una PR por etapa)
- **BG-006.0 — Baseline/ADRs:** fijar contratos y mapa de integración real; prueba comparativa coste/calidad de 1 vs 2 pasadas, presupuesto técnico máximo por solicitud. Sin runtime.
- **BG-006.1 — Backend:** habilitar Functions + secretos + deploy específico + emulador; autenticación, cuotas de IA, requestId, timeouts, costes y pruebas de seguridad. No alterar el deploy Hosting actual.
- **BG-006.2 — Normalización texto:** prompt versionado, JSON estricto, limpieza y requisitos completos, detección faltantes; tests unitarios y evals.
- **BG-006.3 — Recuperación:** selección catálogo autorizado, ranking léxico por descripción/categoría/sinónimos, límite candidatos, lectura plantilla, snapshot/revisiones y conflictos; tests tenant isolation.
- **BG-006.4 — Generador:** selección en lista permitida, deduplicación de tareas de plantilla, cantidades y advertencias; validador/hidratador determinista; tests de montos sin LLM real.
- **BG-006.5 — UI texto:** entrada junto al flujo actual de creación, plantilla/catálogo, preview y preguntas; integración draft/store sin sobrescribir borradores; edición y guardado existentes, accesibilidad y responsive.
- **BG-006.6 — Voz:** permisos, grabación, tamaño/tiempo, transcripción, edición antes de enviar y manejo de errores; tests browser.
- **BG-006.7 — Operación:** telemetría de uso por etapa sin PII, rate-limits, presupuesto económico, evaluación y rollout con feature flag. Diseñar monetización prepago como spec aparte si se autoriza.

## Riesgos y mitigaciones
- **Falsas partidas/cantidades:** lista cerrada de candidatos, JSON validado, revisión humana.
- **Tarifa ambigua:** presentar opciones en vez de seleccionar de forma silenciosa.
- **Precios obsoletos:** comprobación de revisión antes de hidratar; pedir nueva confirmación si cambia.
- **Costes malinterpretados:** `cost` es margen/coste interno, no precio al cliente; nunca transmitirlo al LLM.
- **Doble mano de obra:** detectar solape entre tarifas compuestas, plantilla y petición; exigir revisión.
- **Audio largo o ataque de prompt:** límites, allowlists, tratar texto como datos y cuotas servidor.
- **Despliegue:** no activar Functions ni tocar producción hasta autorización y pruebas de emulador.

## Criterios de aceptación verificables
- Toda línea de catálogo aceptada referencia una tarifa del UID autenticado. Los conceptos sin tarifa se identifican como nuevos, requieren confirmación y precio/coste/unidad/cantidad completados por el usuario; cero precios inventados.
- No se envía `cost` ni PII de cliente a OpenAI en generación ordinaria.
- Se preservan IVA, ajuste y tareas de plantilla, sin duplicados introducidos silenciosamente.
- Sin cantidades inferidas silenciosamente: `null`/pregunta/revisión cuando falta medición.
- Resultado editable en `BudgetEditor`; nada se guarda hasta `saveDraft` y cuota existente.
- Cambio de sesión, solicitud repetida y errores no producen contaminación ni duplicados.
- Tests de schema, integridad de precios, autorización, Firestore/emulador, regresión `budgetMath`, `pnpm lint`, `pnpm build` y suites existentes antes del merge.
- Métricas reales: coste por presupuesto, latencia p50/p95, selección correcta de tarifas en evals predefinidos y tasa de correcciones; fijar umbral de precisión después de crear dataset representativo.

## Definition of Done
Cada PR incluye tests ejecutados con resultados, modificaciones mínimas, doc/ADR actualizados y compatibilidad con datos existentes. Ejecución local autorizada el 16-10-2026; activar proveedor, facturación o desplegar IA requiere autorización específica. M7 queda fuera del alcance.

## Preparación local BG-006.0

Decisiones y evaluación en `BG-006-baseline.md`; contratos detallados en `BG-006-contracts.md`. Corpus sintético de 13 casos y evaluador offline en scripts/ai-baseline. Prueba real 1 vs 2 pasadas pendiente de clave de servidor y modelo/tarifas verificados; no hay resultados reales ni UI de IA en producción.

## Nota de archivo (18-10-2026)

El wizard guiado de BG-008 es el flujo vigente para elegir partidas, conceptos y cantidades. No hay una tarea posterior de IA ni una reevaluación programada. Si el usuario vuelve a solicitarla, habrá que definir un alcance nuevo antes de implementar.

## Ampliación solicitada — conceptos sin tarifa (16-10-2026)

Si la petición contiene un trabajo que no tiene tarifa adecuada, no omitirlo ni forzar una coincidencia. Proponerlo en un bloque separado con distintivo **«Concepto nuevo · No está en tu catálogo»**, motivo y acción **«Completar y añadir»**. La IA puede sugerir descripción y partida de agrupación; cualquier unidad/cantidad sugerida debe revisarse. Precio y coste interno quedan vacíos, sin estimaciones generadas ni ceros por defecto. El coste interno no se muestra en salida al cliente.

El concepto sólo se incorpora al borrador después de que el usuario confirme descripción, partida, unidad, cantidad positiva, precio y coste válidos. Precio/coste cero sólo mediante entrada explícita del usuario. Mientras esté incompleto no se incluye en totales ni se presenta como presupuesto completo; la revisión muestra cuántos conceptos siguen pendientes. Descartarlo exige acción explícita y no borra el requisito silenciosamente. Si falta información sobre qué trabajo se solicita, preguntar antes de proponerlo.

Distinguir falta de cobertura de falta de categoría/partida: si existe una tarifa adecuada pero falta su agrupación, crear únicamente el WorkItem necesario, reutilizando el precio real del catálogo. Si se trata de un concepto nuevo, añadirlo al presupuesto no modifica el catálogo. Guardar para reutilizar es una acción opcional e independiente, incluida en la ampliación siguiente.

Esto amplía la restricción inicial de «sólo tarifas de catálogo», conservando la prohibición de inventar referencias y precios. Los contratos v1 y el evaluador actuales sólo cubren líneas de catálogo: diseñar v2 antes de implementar esta UI o evaluar cobertura completa. Casos pendientes: petición mixta conocida/nueva, concepto totalmente nuevo, agrupación nueva con tarifa existente, coincidencia dudosa, precio vacío frente a cero explícito, descartar, completar y doble incorporación.

## Ampliación solicitada — reutilizar conceptos nuevos (16-10-2026)

Después de completar y aceptar un concepto nuevo, ofrecer **«Guardar para reutilizar»**, con destinos independientes y desmarcados inicialmente:

- **Guardar en catálogo**: elegir catálogo propio; revisar descripción, categoría, unidad, precio base y coste interno. No copiar total de línea, cantidad, IVA ni el ajuste del presupuesto al precio base.
- **Añadir a plantilla**: elegir plantilla propia y partida de destino, o crear una partida indicando nombre. Mostrar la tarea que se añadirá. No copiar cantidades específicas de la obra por defecto: cantidad reutilizable confirmada por el usuario, o cantidad pendiente (0 en el dominio actual, mostrada vacía). Conservar todas las demás tareas, IVA, ajuste y catálogo de la plantilla.
- Se pueden seleccionar ambos destinos o ninguno. Una opción adicional **«Crear plantilla nueva»** solicita nombre y preview de los conceptos seleccionados; sólo incluir esos conceptos, nunca cliente, dirección ni el presupuesto completo sin selección explícita. Crear un catálogo nuevo no forma parte de esta ampliación.

Un botón explícito **«Guardar en los destinos seleccionados»** muestra el resumen y realiza las escrituras. Añadir al borrador de presupuesto no escribe por sí mismo en catálogo ni plantilla. Guardar recursos reutilizables no guarda el presupuesto ni consume su cuota; la UI explica que esos recursos se conservan aunque después se descarte el borrador.

Validar nuevamente UID, propiedad, snapshots y posibles coincidencias de descripción/unidad en cada destino. Ante duplicado, mostrar el concepto existente y permitir omitir; nunca reemplazar silenciosamente. Si hay tarifas parecidas con distinto precio, el usuario revisa la diferencia antes de crear una nueva. Si el catálogo asociado a la plantilla difiere del seleccionado, advertir y exigir resolver destinos; no reasignar catalogId automáticamente.

Crear IDs nuevos y operaciones idempotentes por concepto/destino; deshabilitar doble envío. Ante error parcial, mostrar por separado **«Catálogo: guardado» / «Plantilla: pendiente»**, conservar el borrador y reintentar sólo el destino fallido sin duplicados. No afirmar guardado hasta confirmación de persistencia. Un cambio de sesión cancela/ignora respuestas tardías y elimina estado pendiente del usuario anterior.

No enviar los datos manuales ni costes internos de esta reutilización al modelo. Son escrituras de biblioteca bajo control del usuario. Requiere ampliar contratos v2 y APIs de stores con inserción aditiva/conflictos (las APIs actuales escriben documentos completos y no garantizan concurrencia). Pruebas pendientes: cada destino y ambos, ninguno, plantilla nueva, cantidades pendientes, precio base frente a ajuste/IVA, duplicados, cambios concurrentes, permisos, fallo parcial, reintento, recarga y cambio de UID. Validación real con emuladores antes de considerar seguro el guardado.

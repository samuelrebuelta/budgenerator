# BG-006 — Generación asistida de presupuestos por IA (SDD)
Estado: Pendiente · Prioridad: Alta · Fecha: 2026-10-15
Alcance: especificación aprobada para planificación; NO autoriza implementación, despliegue ni cambios de facturación.

## Objetivo y alcance
Generar un **borrador editable** de presupuesto a partir de texto o audio transcrito, utilizando exclusivamente tarifas pertenecientes a un catálogo autorizado del usuario y reutilizando la plantilla existente seleccionada. Flujo: transcripción (solo voz) → normalización estructurada → recuperación de candidatos → selección IA → validación determinista → editor habitual → guardado explícito.

No incluye generación de nuevas tarifas o plantillas, CRM, pagos automáticos, modificación del motor de cálculo, ni cambios en Web Factory Lite.

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
- 100% de partidas aceptadas tienen tarifa del catálogo del UID autenticado; cero precios inventados.
- No se envía `cost` ni PII de cliente a OpenAI en generación ordinaria.
- Se preservan IVA, ajuste y tareas de plantilla, sin duplicados introducidos silenciosamente.
- Sin cantidades inferidas silenciosamente: `null`/pregunta/revisión cuando falta medición.
- Resultado editable en `BudgetEditor`; nada se guarda hasta `saveDraft` y cuota existente.
- Cambio de sesión, solicitud repetida y errores no producen contaminación ni duplicados.
- Tests de schema, integridad de precios, autorización, Firestore/emulador, regresión `budgetMath`, `pnpm lint`, `pnpm build` y suites existentes antes del merge.
- Métricas reales: coste por presupuesto, latencia p50/p95, selección correcta de tarifas en evals predefinidos y tasa de correcciones; fijar umbral de precisión después de crear dataset representativo.

## Definition of Done
Cada PR incluye tests ejecutados con resultados, modificaciones mínimas, doc/ADR actualizados y compatibilidad con datos existentes. Esta spec es solo plan; el desarrollo necesita autorización específica. M7 queda fuera del alcance.

# BG-006.0 — Base local y decisiones de integración (archivo histórico)

Estado: archivado; fuera del roadmap desde 18-10-2026. Este contenido y el evaluador offline quedan como referencia histórica, no como trabajo pendiente ni aprobación para integrar IA. Especificación de referencia: `BG-006-ai-budget-generation.md`.

## Alcance de esta entrega

Fijar contratos y puntos de integración reales, preparar un corpus sintético y medir salidas guardadas de una o dos pasadas con una herramienta offline. No añade runtime a la aplicación, dependencias, llamadas a proveedores, Functions, secretos, facturación ni cambios de reglas. No modifica el prototipo conservado en el checkout original. No publica BG-006 aprovechando la autorización anterior de despliegue de UX.

## ADR 1 — Integración con lo que existe

| Punto real | Integración prevista |
| --- | --- |
| `src/pages/budgets/BudgetsPage.tsx` | Entrada de generación junto a creación manual; selección explícita de plantilla/catálogo. No sustituir botones actuales. |
| `src/entities/catalog/model/store.ts` | Leer catálogo seleccionado para preview. El backend volverá a leer exclusivamente `users/{auth.uid}/tariffCatalogs/{id}`; nunca confiar en tarifas enviadas por cliente. |
| `src/entities/template/model/store.ts` | Seleccionar plantilla sin modificar el documento original. Las plantillas no tienen `updatedAt`: usar huella de contenido. |
| `src/entities/budget/model/store.ts` | Añadir en BG-006.5 una API pública atómica de aplicación; no usar `setState` desde UI ni `startDraftFromTemplate` sobre un borrador sucio. |
| `src/shared/model/session.ts` | Capturar UID y revisión antes de pedir propuesta; rechazar respuestas tras cerrar sesión o cambiar de usuario. |
| `src/shared/lib/budgetMath.ts` | Única política de precios, redondeo, ajuste e IVA. La IA no suma ni decide precios. |
| `saveDraft` / `createBudget` | Guardado explícito con transacción y cuota actuales, una sola creación. Generar no consume `totalBudgetsCreated`. |
| `scripts/deploy.mjs` | Hosting permanece independiente. El futuro backend tendrá script/emuladores propios. |

La revisión de `firestore.rules` confirma que las futuras colecciones técnicas de uso/idempotencia no son escribibles desde el cliente. Admin SDK elude esas reglas: el handler deberá validar por sí mismo UID, pertenencia y límites. La IA se restringirá al UID autenticado, aunque el administrador pueda editar otros datos por los flujos actuales.

## ADR 2 — Compatibilidad con el prototipo conservado

`features/budget-assistant/model/proposal.ts` ya contiene búsqueda léxica local y `proposalItems`; la UI permite elegir conceptos y cantidades y comparar el catálogo/presupuesto antes de añadir. `appendWorkItems` protege el presupuesto mediante identidad de objeto y regenera IDs. Es trabajo útil, pero no es generación IA, no existe en main y no cubre servidor, versiones de contenido, cancelación ni plantillas.

Reutilizar las decisiones de interacción y casos de regresión cuando llegue BG-006.5. Portar únicamente lo necesario con la UX actual, sin mezclar en bloque la rama antigua ni usar su búsqueda como si fuera una respuesta del modelo. La búsqueda podrá servir como baseline de recuperación en BG-006.3.

## ADR 3 — Seguridad, versión y aplicación

Contrato detallado en `BG-006-contracts.md`. Las cantidades desconocidas permanecen `null` durante propuesta/revisión. Para el primer flujo se exige resolver todas las líneas seleccionadas antes de aplicar; evita persistir marcadores de incompleto en un dominio que hoy sólo entiende cantidades numéricas. Las líneas ya cubiertas por plantilla no se añaden otra vez; las coincidencias dudosas requieren pregunta y revisión, no deduplicación silenciosa por texto.

El flujo genera propuestas aditivas. Las intenciones `remove`/`replace` se normalizan pero no borran ni reemplazan tareas automáticamente. Se explican en revisión y el usuario realiza esas acciones en el editor actual. Cambio respecto a una interpretación destructiva de esos verbos: preserva el objetivo de borrador editable y evita pérdidas.

## ADR 4 — Límites técnicos provisionales

Son límites de trabajo para implementación y evaluación local, no cuotas comerciales aprobadas ni servicios activados:

| Recurso | Propuesta inicial |
| --- | --- |
| Texto de entrada | 4.000 caracteres; hasta 30 requisitos |
| Candidatos por selección | 30; si no hay cobertura, preguntar |
| Salida | 50 líneas, 20 preguntas y 20 advertencias; textos de 500 caracteres |
| Cantidad | Finita, mayor que 0 y hasta 1.000.000; `null` si falta medición |
| Llamadas | Máximo 2 por generación de texto, sin reintento automático de pago |
| Tokens totales reservados | 12.000 de entrada + 2.000 de salida entre ambas pasadas |
| Tiempo | 30 s de trabajo servidor; cancelar/ignorar desde cliente si expira |
| Concurrencia/usuario | 1 generación, con reserva atómica |
| Piloto | 20 solicitudes por UID/día; presupuesto técnico máximo propuesto de 0,03 USD por solicitud |

Antes de llamar al proveedor, calcular el peor coste con tarifas configuradas y tokens máximos; si excede el techo, rechazar sin llamar. Reservar antes, reconciliar uso después, nunca descontar cuota de presupuesto. Estos valores deben contrastarse con el modelo y sus tarifas verificadas cuando exista una clave de servidor. Audio tendrá límites y presupuesto propios en BG-006.6; no se presupone que quepa en el límite de texto.

## Evaluación reproducible

Corpus: `docs/testing-evidence/ai-baseline/corpus.v1.json`, 13 casos sintéticos españoles con candidatos reducidos, cantidades explícitas/ausentes, exclusión, plantilla, tarifa compuesta, ambigüedad, falta de cobertura, intento de inyección y coma decimal. No contiene PII, claves ni costes internos. Es un conjunto de desarrollo, no prueba de precisión en reformas reales.

Herramienta: `scripts/ai-baseline/report.mjs` y `evaluate.mjs`. Evalúa resultados guardados, no genera con IA. Rechaza referencias ajenas, precios/campos no contratados, duplicados, cantidades inválidas, claves de sección inexistentes y falta de revisión cuando quantity es null. Exactitud requiere mismos candidatos, cantidades y destino que el oracle; si hay duda pendiente exige al menos una pregunta. La calidad del texto de la pregunta y los solapes semánticos requieren evaluación humana.

Cada ejecución se representa así:

```json
{
  "caseId": "paint-explicit", "strategy": "one-pass", "attempt": 1,
  "source": "provider", "model": "modelo-verificado", "promptVersion": "v1",
  "latencyMs": 900, "inputTokens": 100, "outputTokens": 40,
  "proposal": { "schemaVersion": 1, "lines": [], "questions": [], "warnings": [] }
}
```

Los tokens y tiempo de dos pasadas son la suma de sus etapas; contabilizar también consumo de fallos/reintentos si se autorizaran. Registrar salida inválida como tal y no eliminarla del conjunto para mejorar métricas. `source: synthetic` etiqueta fixtures de prueba; no mezclar con provider. Tokens/costes de una fixture no son coste real.

```sh
node scripts/ai-baseline/report.mjs docs/testing-evidence/ai-baseline/corpus.v1.json /tmp/bg006-runs.json /tmp/bg006-prices.json
```

`runs.json` es un array de registros. `prices.json` opcional contiene `inputUsdPerMillion` y `outputUsdPerMillion` en USD para el modelo seleccionado; sin tarifas, coste = null. Conservar fecha, enlace de tarifas y versión del modelo junto al informe, no atribuir una tarifa ficticia al proveedor. Esta primera herramienta calcula coste estándar sin descuento de caché; si se activa otro tipo de token o pricing se adaptará antes de medirlo.

El informe sólo incluye métricas agregadas (sin prompts/propuestas): tasa exacta, salidas inválidas, cobertura, tokens, coste agregado y latencias p50/p95. `comparisonComplete` sólo es true si ambos grupos cubren todos los casos y los intentos están emparejados. No equivale a aprobar calidad. Se rechazan intentos duplicados y modelos/fuentes mezclados.

Protocolo real pendiente: mismo modelo/configuración y candidatos, prompt versionado por estrategia, tres repeticiones por caso (78 ejecuciones: 13 × 3 × 2). Primera prueba piloto: un intento por caso/estrategia; continuar sólo si no hay errores de contrato y el coste cabe en el presupuesto autorizado. Mantener al menos 20 casos reales anonimizados separados como conjunto final antes de rollout; no ajustar prompts sobre ellos.

Puerta para elegir estrategia: cero referencias ajenas ni precios inventados en resultados aceptados; ningún precio/cantidad alterado por hidratación; revisar manualmente duplicados semánticos y preguntas. Priorizar mayor tasa exacta; a igualdad, menor coste y p95. Registrar además la tasa de correcciones humanas en piloto. Sin benchmark real no se cambia el valor por defecto de dos pasadas de la spec ni se afirma una mejora medida.

## Registro y próximos pasos

- [x] Revisar spec, dominio, stores, APIs públicas, sesión, motor de cálculo y reglas reales.
- [x] Fijar contratos de petición/respuesta, snapshots y aplicación sin sobrescritura.
- [x] Preparar corpus y evaluador offline sin dependencias nuevas.
- [ ] Ejecutar comparación real coste/calidad: pendiente clave de servidor, modelo y precios verificados; no se ha enviado ninguna petición.
- [ ] Validar límites propuestos con los resultados y cerrar BG-006.0.
- [ ] BG-006.1: Functions local con proveedor falso explícito en emulador, Auth, reservas de cuota e idempotencia. No habilitar proyecto/billing ni desplegar por esta fase documental.

No hay una generación IA operativa ni una nueva interfaz publicada. Los nueve tests del evaluador están en verde; arranque en rojo por módulo inexistente y regresión de promptVersion en rojo→verde. La evaluación real sigue pendiente.

## Revisión y verificación

Revisión independiente de scripts, corpus y contratos: sin bloqueantes de aplicación (no hay runtime). Se elevó a importante el riesgo de mezclar versiones de prompt por estrategia; corregido con prueba RED→GREEN, versión constante y versión incluida en informe. Suite final: 33 unitarias; lint, formato y build correctos. CLI ejercitada con 26 salidas sintéticas (13 × 2), sin coste real ni calidad de modelo medida. No se repitieron E2E ni reglas: no cambian app, stores o reglas.

Ruling: límites de coste/uso son propuestas de desarrollo, no presupuesto aprobado ni métricas observadas; coste si son inadecuados: ajustar límites y repetir evaluación antes de activar proveedor.

Ruling: calidad de IA, ranking semántico y viabilidad del backend no quedan aprobados por este evaluador; se mantienen gates de implementación y prueba real. Coste si se ignora: publicar calidad/coste no medidos.

Final: minor (deferred): el corpus aún no cubre targetWorkItemKey no nulo (válido, ajeno y destino equivocado). Añadir esos casos antes de implementar selección de secciones/hidratación en BG-006.4.

Ampliación posterior: el usuario solicita conceptos nuevos cuando no haya tarifa, con indicación visual explícita y cumplimentación manual. Ver spec canónica. El corpus/evaluador v1 permanece como baseline sólo de catálogo; la prueba uncovered-roof no valida la nueva funcionalidad. Pendiente contrato/evaluador v2 y casos mixtos antes de implementarla.

Nueva ampliación de planificación: reutilización opcional de conceptos nuevos en catálogo y/o plantilla, con selección explícita, precio base sin IVA/ajuste, cantidad reutilizable independiente y estado por destino. Incluye creación explícita de plantilla con conceptos seleccionados. No modifica stores en esta entrega; requiere contratos v2, inserciones aditivas e idempotencia/fallos parciales probados con emuladores.

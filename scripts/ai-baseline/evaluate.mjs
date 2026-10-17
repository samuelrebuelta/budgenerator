// Herramienta offline: no llama a proveedores ni importa código de la aplicación.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) =>
  object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
const textList = (value) => Array.isArray(value) && value.length <= 20 && value.every(text);
const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const signature = (line) =>
  JSON.stringify([line.candidateId, line.quantity, line.targetWorkItemKey ?? null]);
export function evaluateProposal(fixture, proposal) {
  const errors = [];
  if (
    !exactKeys(proposal, ['schemaVersion', 'lines', 'questions', 'warnings']) ||
    proposal.schemaVersion !== 1 ||
    !Array.isArray(proposal.lines) ||
    proposal.lines.length > 50 ||
    !textList(proposal.questions) ||
    !textList(proposal.warnings)
  ) {
    return { valid: false, exact: false, errors: ['schema'] };
  }
  const seen = new Set();
  for (const line of proposal.lines) {
    if (
      !exactKeys(line, ['candidateId', 'targetWorkItemKey', 'quantity', 'reason', 'reviewRequired'])
    ) {
      errors.push('line-schema');
      continue;
    }
    if (!fixture.candidateIds.includes(line.candidateId)) errors.push('unauthorized-candidate');
    if (seen.has(line.candidateId)) errors.push('duplicate-candidate');
    seen.add(line.candidateId);
    if (
      line.targetWorkItemKey !== null &&
      !(fixture.workItemKeys ?? []).includes(line.targetWorkItemKey)
    )
      errors.push('unknown-section');
    if (
      line.quantity !== null &&
      (!finite(line.quantity) || line.quantity === 0 || line.quantity > 1_000_000)
    )
      errors.push('quantity');
    if (!text(line.reason) || typeof line.reviewRequired !== 'boolean') errors.push('line-schema');
    if (line.quantity === null && !line.reviewRequired) errors.push('unreviewed-quantity');
  }
  const expected = fixture.expectedLines.map(signature).sort();
  const actual = proposal.lines.filter(object).map(signature).sort();
  const valid = errors.length === 0;
  const exact =
    valid &&
    JSON.stringify(expected) === JSON.stringify(actual) &&
    (!fixture.requiresQuestion || proposal.questions.length > 0);
  return { valid, exact, errors: [...new Set(errors)] };
}
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
export function summarizeRuns(fixtures, runs, prices = null) {
  if (!Array.isArray(runs) || runs.length === 0)
    throw new Error('No hay ejecuciones para evaluar.');
  if (prices && (!finite(prices.inputUsdPerMillion) || !finite(prices.outputUsdPerMillion)))
    throw new Error('Tarifas de evaluación inválidas.');
  const cases = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  if (cases.size !== fixtures.length || cases.size === 0)
    throw new Error('Corpus vacío o con IDs repetidos.');
  const seen = new Set();
  const groups = { 'one-pass': [], 'two-pass': [] };
  for (const run of runs) {
    if (
      !object(run) ||
      !cases.has(run.caseId) ||
      !Object.hasOwn(groups, run.strategy) ||
      !['synthetic', 'provider'].includes(run.source) ||
      run.source !== runs[0].source ||
      !text(run.model) ||
      run.model !== runs[0].model ||
      !text(run.promptVersion) ||
      !Number.isInteger(run.attempt) ||
      run.attempt < 1 ||
      !finite(run.latencyMs) ||
      !Number.isSafeInteger(run.inputTokens) ||
      run.inputTokens < 0 ||
      !Number.isSafeInteger(run.outputTokens) ||
      run.outputTokens < 0
    )
      throw new Error('Ejecución inválida, incompleta o no comparable.');
    if (groups[run.strategy].length && groups[run.strategy][0].promptVersion !== run.promptVersion)
      throw new Error('No se pueden mezclar versiones de prompt en una estrategia.');
    const key = JSON.stringify([run.caseId, run.attempt, run.strategy]);
    if (seen.has(key)) throw new Error('Ejecución duplicada.');
    seen.add(key);
    groups[run.strategy].push({
      ...run,
      evaluation: evaluateProposal(cases.get(run.caseId), run.proposal),
    });
  }
  const pairs = Object.values(groups).map(
    (group) => new Set(group.map((run) => JSON.stringify([run.caseId, run.attempt]))),
  );
  const comparisonComplete =
    fixtures.every((fixture) => groups['one-pass'].some((run) => run.caseId === fixture.id)) &&
    pairs[0].size === pairs[1].size &&
    [...pairs[0]].every((key) => pairs[1].has(key));
  const strategies = Object.fromEntries(
    Object.entries(groups).map(([strategy, group]) => {
      if (!group.length) return [strategy, null];
      const inputTokens = group.reduce((sum, run) => sum + run.inputTokens, 0);
      const outputTokens = group.reduce((sum, run) => sum + run.outputTokens, 0);
      return [
        strategy,
        {
          promptVersion: group[0].promptVersion,
          samples: group.length,
          cases: new Set(group.map((run) => run.caseId)).size,
          exactRate: group.filter((run) => run.evaluation.exact).length / group.length,
          invalidCount: group.filter((run) => !run.evaluation.valid).length,
          p50Ms: percentile(
            group.map((run) => run.latencyMs),
            0.5,
          ),
          p95Ms: percentile(
            group.map((run) => run.latencyMs),
            0.95,
          ),
          inputTokens,
          outputTokens,
          costUsd: prices
            ? (inputTokens * prices.inputUsdPerMillion +
                outputTokens * prices.outputUsdPerMillion) /
              1_000_000
            : null,
        },
      ];
    }),
  );
  return {
    schemaVersion: 1,
    source: runs[0].source,
    model: runs[0].model,
    comparisonComplete,
    strategies,
  };
}

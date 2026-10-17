import { describe, expect, it } from 'vitest';
import { evaluateProposal, summarizeRuns } from '../scripts/ai-baseline/evaluate.mjs';
const fixture = {
  id: 'explicit',
  candidateIds: ['paint'],
  expectedLines: [{ candidateId: 'paint', quantity: 20 }],
  requiresQuestion: false,
};
const line = {
  candidateId: 'paint',
  targetWorkItemKey: null,
  quantity: 20,
  reason: 'Medición explícita',
  reviewRequired: false,
};
const proposal = { schemaVersion: 1, lines: [line], questions: [], warnings: [] };
const run = {
  caseId: 'explicit',
  strategy: 'one-pass',
  attempt: 1,
  source: 'synthetic',
  model: 'fixture',
  promptVersion: 'v1',
  latencyMs: 100,
  inputTokens: 100,
  outputTokens: 20,
  proposal,
};
describe('baseline local de generación IA', () => {
  it('acepta una propuesta exacta sin calcular precios', () => {
    expect(evaluateProposal(fixture, proposal)).toEqual({ valid: true, exact: true, errors: [] });
  });
  it('rechaza referencias ajenas y precios generados por el modelo', () => {
    expect(
      evaluateProposal(fixture, {
        ...proposal,
        lines: [{ ...line, candidateId: 'other', price: 1 }],
      }).valid,
    ).toBe(false);
  });
  it('rechaza duplicados, NaN, ceros y campos privados', () => {
    for (const value of [NaN, Infinity, -1, 0])
      expect(
        evaluateProposal(fixture, { ...proposal, lines: [{ ...line, quantity: value }] }).valid,
      ).toBe(false);
    expect(evaluateProposal(fixture, { ...proposal, lines: [line, line] }).valid).toBe(false);
    expect(evaluateProposal(fixture, { ...proposal, cost: 2 }).valid).toBe(false);
  });
  it('mantiene cantidades desconocidas como null y exige revisión y pregunta', () => {
    const unknown = {
      ...fixture,
      expectedLines: [{ candidateId: 'paint', quantity: null }],
      requiresQuestion: true,
    };
    const unresolved = {
      ...proposal,
      lines: [{ ...line, quantity: null, reviewRequired: true }],
      questions: ['¿Cuántos m²?'],
    };
    expect(evaluateProposal(unknown, unresolved).exact).toBe(true);
    expect(evaluateProposal(unknown, { ...unresolved, questions: [] }).exact).toBe(false);
    expect(
      evaluateProposal(unknown, { ...unresolved, lines: [{ ...line, quantity: null }] }).valid,
    ).toBe(false);
  });
  it('penaliza omisiones, inferencias y tareas cubiertas por plantilla', () => {
    expect(evaluateProposal(fixture, { ...proposal, lines: [] }).exact).toBe(false);
    expect(evaluateProposal({ ...fixture, expectedLines: [] }, proposal).exact).toBe(false);
    expect(
      evaluateProposal(fixture, { ...proposal, lines: [{ ...line, quantity: 21 }] }).exact,
    ).toBe(false);
  });
  it('no mezcla datos sintéticos con reales ni declara comparaciones incompletas', () => {
    const report = summarizeRuns([fixture], [run]);
    expect(report.source).toBe('synthetic');
    expect(report.comparisonComplete).toBe(false);
    expect(report.strategies['one-pass'].costUsd).toBe(null);
    expect(() =>
      summarizeRuns([fixture], [run, { ...run, strategy: 'two-pass', source: 'provider' }]),
    ).toThrow();
  });
  it('compara intentos emparejados con coste explícito y percentiles', () => {
    const report = summarizeRuns(
      [fixture],
      [run, { ...run, strategy: 'two-pass', latencyMs: 200, inputTokens: 200 }],
      { inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
    );
    expect(report.comparisonComplete).toBe(true);
    expect(report.strategies['one-pass'].costUsd).toBeCloseTo(0.00014);
    expect(report.strategies['two-pass'].p95Ms).toBe(200);
  });
  it('mantiene una versión de prompt por estrategia y la conserva en el informe', () => {
    expect(() =>
      summarizeRuns([fixture], [run, { ...run, attempt: 2, promptVersion: 'v2' }]),
    ).toThrow();
    const report = summarizeRuns(
      [fixture],
      [run, { ...run, strategy: 'two-pass', promptVersion: 'two-v1' }],
    );
    expect(report.strategies['one-pass'].promptVersion).toBe('v1');
    expect(report.strategies['two-pass'].promptVersion).toBe('two-v1');
  });
  it('rechaza intentos duplicados, casos desconocidos y métricas corruptas', () => {
    expect(() => summarizeRuns([fixture], [run, run])).toThrow();
    expect(() => summarizeRuns([fixture], [{ ...run, caseId: 'unknown' }])).toThrow();
    expect(() => summarizeRuns([fixture], [{ ...run, latencyMs: -1 }])).toThrow();
  });
});

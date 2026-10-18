import { describe, expect, it } from 'vitest';
import type {
  ProjectProgressMode,
  ProjectTask,
  ProjectWorkItem,
} from '../src/entities/project/model/types';
import {
  calculateProjectProgressHistory,
  normalizeProjectCompletionDate,
} from '../src/entities/project/model/history';

const task = (id: string, price: number, completedAt?: string): ProjectTask => ({
  id,
  description: id,
  quantity: 1,
  unit: 'unit',
  price,
  cost: 0,
  ...(completedAt ? { completedAt } : {}),
});

const item = (id: string, tasks: ProjectTask[], voidedAt?: string): ProjectWorkItem => ({
  id,
  name: id,
  tasks,
  ...(voidedAt ? { voidedAt } : {}),
});

describe('calculateProjectProgressHistory', () => {
  it('groups completions by local day and orders daily cumulative progress', () => {
    const history = calculateProjectProgressHistory(
      [
        item('part-a', [
          task('first', 20, '2026-10-17'),
          task('second', 30, '2026-10-17'),
          task('third', 50, '2026-10-18'),
        ]),
      ],
      'amount',
    );

    expect(history).toEqual([
      { date: '2026-10-17', percent: 50, completedConcepts: 2 },
      { date: '2026-10-18', percent: 100, completedConcepts: 3 },
    ]);
  });

  it.each([
    ['amount', 10],
    ['concepts', 50],
  ] as [ProjectProgressMode, number][])('weights the chart by %s mode', (mode, percent) => {
    const history = calculateProjectProgressHistory(
      [item('part-a', [task('done', 10, '2026-10-17'), task('remaining', 90)])],
      mode,
    );

    expect(history[0]?.percent).toBe(percent);
  });

  it('moves a point when a completed concept date changes', () => {
    const before = calculateProjectProgressHistory(
      [item('part-a', [task('done', 10, '2026-10-17'), task('remaining', 10)])],
      'concepts',
    );
    const after = calculateProjectProgressHistory(
      [item('part-a', [task('done', 10, '2026-10-18'), task('remaining', 10)])],
      'concepts',
    );

    expect(before.map((point) => point.date)).toEqual(['2026-10-17']);
    expect(after.map((point) => point.date)).toEqual(['2026-10-18']);
    expect(after[0]?.percent).toBe(50);
  });

  it('excludes reopened concepts and voided supplement work', () => {
    const history = calculateProjectProgressHistory(
      [
        item('active', [task('done', 50, '2026-10-17'), task('reopened', 50)]),
        item('voided', [task('voided-done', 500, '2026-10-16')], '2026-10-18'),
      ],
      'amount',
    );

    expect(history).toEqual([{ date: '2026-10-17', percent: 50, completedConcepts: 1 }]);
  });

  it('returns no points when no active concept has a completion date', () => {
    expect(
      calculateProjectProgressHistory([item('part-a', [task('pending', 20)])], 'amount'),
    ).toEqual([]);
    expect(calculateProjectProgressHistory([], 'concepts')).toEqual([]);
  });
});

describe('normalizeProjectCompletionDate', () => {
  it('accepts today as a local date-only value', () => {
    expect(normalizeProjectCompletionDate('2026-10-18', '2026-10-18')).toBe('2026-10-18');
  });

  it('rejects a future completion date', () => {
    expect(() => normalizeProjectCompletionDate('2026-10-19', '2026-10-18')).toThrow(/futura/i);
  });
});

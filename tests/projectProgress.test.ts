import { describe, expect, it } from 'vitest';
import type { ProjectWorkItem } from '../src/entities/project/model/types';
import { calculateProjectProgress } from '../src/entities/project/model/progress';

const item = (tasks: ProjectWorkItem['tasks']): ProjectWorkItem => ({
  id: 'part-1',
  name: 'Albañilería',
  tasks,
});

const task = (id: string, quantity: number, price: number, completed = false) => ({
  id,
  description: id,
  quantity,
  unit: 'unit' as const,
  price,
  cost: 0,
  ...(completed ? { completedAt: '2026-10-18T10:00:00.000Z' } : {}),
});

describe('calculateProjectProgress', () => {
  it('returns a pending zero-value summary for an empty project snapshot', () => {
    expect(calculateProjectProgress([])).toEqual({
      mode: 'concepts',
      totalConcepts: 0,
      completedConcepts: 0,
      totalAmount: 0,
      completedAmount: 0,
      percent: 0,
      status: 'pending',
    });
  });

  it('weights progress by line amount and excludes global adjustments and IVA', () => {
    const progress = calculateProjectProgress([
      item([task('completed', 2, 50, true)]),
      { ...item([task('pending', 3, 100)]), id: 'part-2' },
    ]);

    expect(progress).toEqual({
      mode: 'amount',
      totalConcepts: 2,
      completedConcepts: 1,
      totalAmount: 400,
      completedAmount: 100,
      percent: 25,
      status: 'in_progress',
    });
  });

  it('rounds each net line amount using the budget amount policy', () => {
    const progress = calculateProjectProgress([item([task('completed', 2.5, 10.75, true)])]);

    expect(progress.totalAmount).toBe(26.88);
    expect(progress.completedAmount).toBe(26.88);
    expect(progress.percent).toBe(100);
  });

  it('uses concept count for every line when one line has no positive amount', () => {
    const progress = calculateProjectProgress([
      item([task('completed', 1, 80, true), task('free', 1, 0)]),
    ]);

    expect(progress.mode).toBe('concepts');
    expect(progress.totalConcepts).toBe(2);
    expect(progress.completedConcepts).toBe(1);
    expect(progress.percent).toBe(50);
  });

  it('marks a project completed only when every concept has a completion date', () => {
    const progress = calculateProjectProgress([
      item([task('first', 1, 20, true), task('second', 1, 30, true)]),
    ]);

    expect(progress.status).toBe('completed');
    expect(progress.percent).toBe(100);
  });

  it('counts concepts across parts and keeps an empty part pending', () => {
    const progress = calculateProjectProgress([
      item([]),
      { ...item([task('only', 1, 10, true)]), id: 'part-2' },
    ]);

    expect(progress.totalConcepts).toBe(1);
    expect(progress.completedConcepts).toBe(1);
    expect(progress.status).toBe('completed');
  });

  it('excludes voided supplement work from amount, progress, and active status', () => {
    const voided = {
      ...item([task('voided', 1, 50, true)]),
      voidedAt: '2026-10-18T12:00:00.000Z',
    };
    const progress = calculateProjectProgress([voided, item([task('active', 1, 100)])]);

    expect(progress).toMatchObject({
      totalConcepts: 1,
      completedConcepts: 0,
      totalAmount: 100,
      completedAmount: 0,
      percent: 0,
      status: 'pending',
    });
  });

  it('does not round an active project to 100 percent while work is still pending', () => {
    const progress = calculateProjectProgress([
      item([task('completed-large', 1, 10_000, true), task('pending-small', 1, 0.01)]),
    ]);

    expect(progress.status).toBe('in_progress');
    expect(progress.percent).toBe(99);
  });
});

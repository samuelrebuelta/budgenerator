import { describe, expect, it } from 'vitest';
import * as dailyAssignments from '../src/entities/project/model/dailyAssignments';

const normalizeEstimatedEndDate = Reflect.get(dailyAssignments, 'normalizeEstimatedEndDate') as
  ((value: string) => string) | undefined;
const isOnOrBeforeEstimatedEndDate = Reflect.get(
  dailyAssignments,
  'isOnOrBeforeEstimatedEndDate',
) as ((dateKey: string, estimatedEndDate?: string) => boolean) | undefined;

describe('estimated project end date', () => {
  it('accepts a leap day as a local date key', () => {
    expect(normalizeEstimatedEndDate?.('2024-02-29')).toBe('2024-02-29');
  });

  it('rejects an impossible local date', () => {
    expect(() => normalizeEstimatedEndDate?.('2026-02-30')).toThrow(
      'La fecha estimada de fin no es válida.',
    );
  });

  it('includes the estimated end date and excludes later days', () => {
    expect(isOnOrBeforeEstimatedEndDate?.('2026-11-06', '2026-11-06')).toBe(true);
    expect(isOnOrBeforeEstimatedEndDate?.('2026-11-07', '2026-11-06')).toBe(false);
  });

  it('keeps legacy projects visible until an estimated date is set', () => {
    expect(isOnOrBeforeEstimatedEndDate?.('2026-11-07')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateFromKey,
  isDateKey,
  shiftWeeks,
  startOfWeek,
  toDateKey,
  weekDateKeys,
} from '../src/shared/lib/dateKey';

describe('dateKey', () => {
  it('round-trips local days at noon', () => {
    const date = dateFromKey('2026-03-29');
    expect(date.getHours()).toBe(12);
    expect(toDateKey(date)).toBe('2026-03-29');
  });

  it('validates real calendar days', () => {
    expect(isDateKey('2026-02-28')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('computes Monday-based weeks across month and DST boundaries', () => {
    expect(toDateKey(startOfWeek(dateFromKey('2026-11-15')))).toBe('2026-11-09');
    expect(toDateKey(startOfWeek(dateFromKey('2026-11-09')))).toBe('2026-11-09');
    expect(weekDateKeys(dateFromKey('2026-03-29'))).toEqual([
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
    ]);
    expect(toDateKey(shiftWeeks(dateFromKey('2026-12-28'), 1))).toBe('2027-01-04');
    expect(toDateKey(addDays(dateFromKey('2026-01-01'), -1))).toBe('2025-12-31');
  });
});

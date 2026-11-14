import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateFromKey,
  isDateKey,
  shiftWeeks,
  startOfWeek,
  toDateKey,
  weekDateKeys,
} from '../src/lib/dateKey';
import { getWeekDateKeys } from '../src/project/dailyAssignments';
import { getProjectLocalDateKey } from '../src/project/history';

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

describe('shared local date keys', () => {
  it('pads years below 1000 like the former project helpers', () => {
    const date = new Date(2026, 0, 5, 12);
    date.setFullYear(987);
    expect(toDateKey(date)).toBe('0987-01-05');
  });

  it('is the key used by the weekly planning and the progress history', () => {
    const anchor = new Date(2026, 10, 12, 9);
    expect(getWeekDateKeys(anchor)).toEqual(weekDateKeys(anchor));
    expect(getProjectLocalDateKey(new Date(2026, 10, 14, 23, 30).toISOString())).toBe(
      toDateKey(new Date(2026, 10, 14, 23, 30)),
    );
  });
});

/**
 * Local calendar days as `YYYY-MM-DD` keys. Dates are built at 12:00 local time so that
 * daylight-saving changes never move a day.
 */
export type DateKey = string;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toDateKey(date: Date): DateKey {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function dateFromKey(dateKey: DateKey): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

/** True for an existing calendar day (rejects 2026-02-30). */
export function isDateKey(value: string | null | undefined): value is DateKey {
  if (!value || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = dateFromKey(value);
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day;
}

export function todayKey(now = new Date()): DateKey {
  return toDateKey(now);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

/** Monday of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** The same weekday `weeks` weeks away. */
export function shiftWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/** Monday-to-Sunday keys of the week that contains `date`. */
export function weekDateKeys(date: Date): DateKey[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(monday, index)));
}

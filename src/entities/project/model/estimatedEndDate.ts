const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeEstimatedEndDate(value: string): string {
  if (!DATE_ONLY_PATTERN.test(value)) throw new Error('La fecha estimada de fin no es válida.');

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year!, month! - 1, day!);
  date.setHours(12, 0, 0, 0);

  if (
    year! < 1 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month! - 1 ||
    date.getDate() !== day
  )
    throw new Error('La fecha estimada de fin no es válida.');

  return value;
}

export function isOnOrBeforeEstimatedEndDate(dateKey: string, estimatedEndDate?: string) {
  return !estimatedEndDate || dateKey <= estimatedEndDate;
}

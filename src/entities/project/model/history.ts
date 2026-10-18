import { money, taskAmount } from '@/shared/lib/budgetMath';
import type { ProjectProgressHistoryPoint, ProjectProgressMode, ProjectWorkItem } from './types';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateKey(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isValidDateKey(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(0);
  candidate.setFullYear(year!, month! - 1, day!);
  candidate.setHours(0, 0, 0, 0);
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month! - 1 &&
    candidate.getDate() === day
  );
}

export function getProjectLocalDateKey(value: string): string {
  if (DATE_ONLY_PATTERN.test(value)) {
    if (!isValidDateKey(value)) throw new Error('La fecha de finalización no es válida.');
    return value;
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('La fecha de finalización no es válida.');
  return dateKey(parsed);
}

export function normalizeProjectCompletionDate(value: string, today = dateKey(new Date())) {
  const normalized = getProjectLocalDateKey(value);
  if (!isValidDateKey(today) || normalized > today)
    throw new Error('La fecha de finalización no puede ser futura.');
  return normalized;
}

export function calculateProjectProgressHistory(
  workItems: ProjectWorkItem[],
  mode: ProjectProgressMode,
): ProjectProgressHistoryPoint[] {
  const tasks = workItems
    .filter((workItem) => !workItem.voidedAt)
    .flatMap((workItem) => workItem.tasks);
  if (!tasks.length) return [];

  const completedByDate = new Map<string, { concepts: number; amount: number }>();
  for (const task of tasks) {
    if (!task.completedAt) continue;
    try {
      const date = getProjectLocalDateKey(task.completedAt);
      const total = completedByDate.get(date) ?? { concepts: 0, amount: 0 };
      total.concepts += 1;
      total.amount = money(total.amount + Math.max(0, taskAmount(task)));
      completedByDate.set(date, total);
    } catch {
      // Malformed historical timestamps should not prevent the project detail from rendering.
    }
  }
  if (!completedByDate.size) return [];

  const totalConcepts = tasks.length;
  const totalAmount = money(
    tasks.reduce((total, task) => total + Math.max(0, taskAmount(task)), 0),
  );
  const useAmount = mode === 'amount' && totalAmount > 0;
  let completedConcepts = 0;
  let completedAmount = 0;
  const result: ProjectProgressHistoryPoint[] = [];

  for (const [date, completion] of [...completedByDate.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    completedConcepts += completion.concepts;
    completedAmount = money(completedAmount + completion.amount);
    const complete = completedConcepts === totalConcepts;
    const roundedPercent = Math.round(
      useAmount ? (completedAmount / totalAmount) * 100 : (completedConcepts / totalConcepts) * 100,
    );
    result.push({
      date,
      percent: complete ? 100 : Math.min(99, roundedPercent),
      completedConcepts,
    });
  }

  return result;
}

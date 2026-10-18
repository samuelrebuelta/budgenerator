import type { ProjectProgress, ProjectWorkItem } from './types';
import { money, taskAmount } from '@/shared/lib/budgetMath';

export function calculateProjectProgress(workItems: ProjectWorkItem[]): ProjectProgress {
  const tasks = workItems
    .filter((workItem) => !workItem.voidedAt)
    .flatMap((workItem) => workItem.tasks);
  const totalConcepts = tasks.length;
  const completedConcepts = tasks.filter((task) => !!task.completedAt).length;
  const lineAmounts = tasks.map((task) => {
    const amount = taskAmount(task);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  });
  const totalAmount = money(lineAmounts.reduce((total, amount) => total + amount, 0));
  const completedAmount = tasks.reduce((total, task) => {
    if (!task.completedAt) return total;
    const amount = taskAmount(task);
    return total + (Number.isFinite(amount) && amount >= 0 ? amount : 0);
  }, 0);
  const roundedCompletedAmount = money(completedAmount);
  const mode =
    totalConcepts > 0 &&
    tasks.every(
      (task) =>
        Number.isFinite(task.quantity) &&
        task.quantity > 0 &&
        Number.isFinite(task.price) &&
        task.price > 0 &&
        taskAmount(task) > 0,
    )
      ? 'amount'
      : 'concepts';
  const roundedPercent =
    totalConcepts === 0
      ? 0
      : Math.round(
          mode === 'amount'
            ? (roundedCompletedAmount / totalAmount) * 100
            : (completedConcepts / totalConcepts) * 100,
        );
  const status =
    completedConcepts === 0 || totalConcepts === 0
      ? 'pending'
      : completedConcepts === totalConcepts
        ? 'completed'
        : 'in_progress';
  const percent = status === 'completed' ? 100 : Math.min(99, roundedPercent);

  return {
    mode,
    totalConcepts,
    completedConcepts,
    totalAmount,
    completedAmount: roundedCompletedAmount,
    percent,
    status,
  };
}

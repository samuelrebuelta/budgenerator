import type { Budget, PublicBudget } from '@/shared/types';
import { unitPrice } from '@/shared/lib/budgetMath';
/** Deliberate allowlist. Never copy private task/catalog/account data into a public snapshot. */
export function toPublicBudget(budget: Budget): PublicBudget {
  const multiplier = budget.adjustment?.multiplier ?? 1;
  return {
    id: budget.id,
    info: {
      clientName: budget.info.clientName,
      address: budget.info.address,
      date: budget.info.date,
      budgetNumber: budget.info.budgetNumber,
    },
    createdAt: budget.createdAt,
    ivaRate: budget.ivaRate ?? 0.1,
    ...(multiplier < 1 ? { adjustment: { multiplier, reason: budget.adjustment!.reason } } : {}),
    workItems: budget.workItems.map((wi) => ({
      id: wi.id,
      name: wi.name,
      tasks: wi.tasks.map((task) => ({
        id: task.id,
        description: task.description,
        quantity: task.quantity,
        unit: task.unit,
        price: unitPrice(task, multiplier),
      })),
    })),
  };
}

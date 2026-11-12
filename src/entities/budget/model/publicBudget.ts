import { decodeContent, projectWorkItems } from '@/entities/construction-document/model';
import type { PublicBudget } from '@/shared/types';
import type { SharedBudget } from '../api/firestore';

/** Derived view of a public snapshot. Prices in the snapshot already include the adjustment. */
export function sharedBudgetView(shared: SharedBudget): PublicBudget {
  const content = decodeContent([shared.content]);
  const { budget } = shared;
  const document = {
    ...content,
    business: {
      name: '',
      clientName: budget.clientName,
      address: budget.address,
      date: budget.date,
      budgetNumber: budget.budgetNumber,
      ivaRate: budget.ivaRate,
    },
  };
  return {
    id: budget.id,
    info: {
      clientName: budget.clientName,
      address: budget.address,
      date: budget.date,
      budgetNumber: budget.budgetNumber,
    },
    createdAt: budget.createdAt,
    ivaRate: budget.ivaRate,
    ...(budget.adjustment ? { adjustment: budget.adjustment } : {}),
    workItems: projectWorkItems(document).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      depth: item.depth,
      tasks: item.tasks.map((task) => ({
        id: task.id,
        code: task.code,
        description: task.description,
        quantity: task.quantity,
        unit: task.unit,
        price: task.price,
        measured: task.measured,
        ...(task.text ? { text: task.text } : {}),
      })),
    })),
  };
}

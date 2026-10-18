import type { Budget } from '@/shared/types';
import { assertBudget, budgetTotals } from '@/shared/lib/budgetMath';
import { calculateProjectProgress } from './progress';
import type { Project, ProjectWorkItem } from './types';

export const MAX_PROJECT_WORK_ITEMS = 200;
export const MAX_PROJECT_WORK_ITEM_BYTES = 900_000;

export interface PreparedProjectSnapshot {
  project: Project;
  workItems: ProjectWorkItem[];
}

export function prepareProjectSnapshot(
  budget: Budget,
  projectId: string,
  convertedAt: string,
): PreparedProjectSnapshot {
  if (!budget.acceptedAt)
    throw new Error('Marca el presupuesto como aceptado antes de convertirlo.');
  if (budget.projectId) throw new Error('Este presupuesto ya está convertido en un proyecto.');
  if (budget.workItems.length > MAX_PROJECT_WORK_ITEMS)
    throw new Error(`El presupuesto supera el límite de ${MAX_PROJECT_WORK_ITEMS} partidas.`);
  assertBudget(budget, true);

  const workItems: ProjectWorkItem[] = budget.workItems.map((workItem, position) => ({
    id: workItem.id,
    name: workItem.name,
    position,
    ...(workItem.catalogPartId ? { catalogPartId: workItem.catalogPartId } : {}),
    tasks: workItem.tasks.map((task) => ({ ...task })),
  }));

  const workItemIds = new Set<string>();
  for (const workItem of workItems) {
    if (!workItem.id.trim() || workItemIds.has(workItem.id))
      throw new Error('Las partidas del presupuesto necesitan identificadores únicos.');
    workItemIds.add(workItem.id);
    const taskIds = new Set<string>();
    for (const task of workItem.tasks) {
      if (!task.id.trim() || taskIds.has(task.id))
        throw new Error('Los conceptos de cada partida necesitan identificadores únicos.');
      taskIds.add(task.id);
    }
    const bytes = new TextEncoder().encode(JSON.stringify(workItem)).length;
    if (bytes >= MAX_PROJECT_WORK_ITEM_BYTES)
      throw new Error(`La partida «${workItem.name}» supera el tamaño permitido para el proyecto.`);
  }

  const progress = calculateProjectProgress(workItems);
  const totals = budgetTotals(budget);
  const project: Project = {
    id: projectId,
    sourceBudgetId: budget.id,
    sourceBudgetNumber: budget.info.budgetNumber,
    title: budget.info.address.trim() || `Presupuesto ${budget.info.budgetNumber}`,
    clientName: budget.info.clientName,
    address: budget.info.address,
    budgetDate: budget.info.date,
    acceptedAt: budget.acceptedAt,
    createdAt: convertedAt,
    subtotal: totals.subtotal,
    iva: totals.iva,
    total: totals.total,
    ivaRate: budget.ivaRate ?? 0.1,
    ...(budget.adjustment ? { adjustment: { ...budget.adjustment } } : {}),
    workItemCount: workItems.length,
    mode: progress.mode,
    totalConcepts: progress.totalConcepts,
    completedConcepts: progress.completedConcepts,
    totalAmount: progress.totalAmount,
    completedAmount: progress.completedAmount,
    percent: progress.percent,
    status: progress.status,
    supplementsSubtotal: 0,
    supplementsIva: 0,
    updatedTotal: totals.total,
  };

  return { project, workItems };
}

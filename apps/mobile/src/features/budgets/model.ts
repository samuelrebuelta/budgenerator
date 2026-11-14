import { budgetCost, budgetTotals, money, taskAmount, workItemSubtreeAmount } from '@bg/domain';
import { budgetView, type BudgetRecord } from '@bg/domain/budget/record';
import type { Budget, BudgetTask, WorkItem } from '@bg/domain/types';

/**
 * Amounts of the mobile screens. Every figure comes from `@bg/domain` (`budgetTotals` and its
 * helpers over the derived `budgetView` of the canonical BC3 document): the app never adds its own
 * arithmetic, so the list, the editor, the PDF and the web show the same euros (parity test).
 */
export function recordTotals(record: BudgetRecord) {
  const view = budgetView(record);
  const totals = budgetTotals(view);
  const cost = budgetCost(view.workItems);
  const margin = money(totals.subtotal - cost);
  return {
    ...totals,
    cost,
    margin,
    marginRatio: totals.subtotal > 0 ? margin / totals.subtotal : 0,
  };
}

export type RecordTotals = ReturnType<typeof recordTotals>;

export function multiplierOf(budget: Pick<Budget, 'adjustment'>) {
  return budget.adjustment?.multiplier ?? 1;
}

/** Amount of an item line, with the surcharge folded into its price (as the web editor). */
export function itemAmount(budget: Budget, task: Pick<BudgetTask, 'quantity' | 'price'>) {
  return taskAmount(task, multiplierOf(budget));
}

/** Amount of a chapter including its subchapters (the web editor's chapter subtotal). */
export function chapterAmount(budget: Budget, chapterId: string) {
  const index = budget.workItems.findIndex((item) => item.id === chapterId);
  if (index < 0) return 0;
  return workItemSubtreeAmount(budget.workItems, index, multiplierOf(budget));
}

/** Text used by the list search: client, address, number, chapters and item descriptions. */
export function searchableText(budget: Budget) {
  return [
    budget.info.clientName,
    budget.info.address,
    budget.info.budgetNumber,
    ...budget.workItems.flatMap((item: WorkItem) => [
      item.name,
      ...item.tasks.map((task) => task.description),
    ]),
  ]
    .join(' ')
    .toLocaleLowerCase('es');
}

export interface BudgetListEntry {
  record: BudgetRecord;
  view: Budget;
  total: number;
}

/** List order and filters of the web's `BudgetsPage`: newest first, by text and year. */
export function filterBudgets(records: readonly BudgetRecord[], search: string, year: string) {
  const query = search.trim().toLocaleLowerCase('es');
  return [...records]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((record): BudgetListEntry => {
      const view = budgetView(record);
      return { record, view, total: budgetTotals(view).total };
    })
    .filter(
      ({ view }) =>
        (!year || view.info.date.startsWith(year)) &&
        (!query || searchableText(view).includes(query)),
    );
}

export function budgetYears(records: readonly BudgetRecord[]) {
  return [...new Set(records.map((record) => budgetView(record).info.date.slice(0, 4)))]
    .filter((value) => /^\d{4}$/.test(value))
    .sort((a, b) => b.localeCompare(a));
}

/** «14 nov 2026», like the web list (`toLocaleDateString('es-ES', …)`). */
export function formatBudgetDate(date: string) {
  if (!date) return 'Sin fecha';
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** The web's «hay cambios» test for a draft before leaving it. */
export function draftHasContent(record: BudgetRecord | null | undefined) {
  if (!record) return false;
  const { business, tree } = record.document;
  return business.clientName !== '' || business.address !== '' || tree.length > 0;
}

/** Item still empty (the web disables «Añadir partida» while one exists in the chapter). */
export function isBlankTask(task: Pick<BudgetTask, 'description' | 'quantity' | 'price'>) {
  return !task.description && task.quantity === 0 && task.price === 0;
}

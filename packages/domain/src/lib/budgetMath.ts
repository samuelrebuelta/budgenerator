import type { Budget, BudgetTask, PublicBudget, WorkItem } from '../types/index.js';
export const DEFAULT_IVA_RATE = 0.1;
/**
 * Rounds to cents, half away from zero, after dropping binary noise: 8.5 × 9.79 is
 * 83.21499999999999 in floating point and must give 83.22. Adding Number.EPSILON is not enough
 * above 1. Same algorithm as `roundTo` in entities/construction-document/model/decimal.ts, which
 * cannot import from here because Functions compile it without the `@/` alias.
 */
export const money = (value: number) => {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const clean = Number(Math.abs(value).toPrecision(15));
  return sign * Number(`${Math.round(Number(`${clean}e2`))}e-2`) || 0;
};
export const decimal = (value: string) => {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
type PricedTask = Pick<BudgetTask, 'quantity' | 'price'>;
type PricedBudget = Pick<Budget, 'adjustment' | 'ivaRate'> & {
  workItems: { tasks: PricedTask[] }[];
};
export function unitPrice(task: PricedTask, multiplier = 1) {
  return money(task.price * Math.max(1, multiplier));
}
export function taskAmount(task: PricedTask, multiplier = 1) {
  return money(task.quantity * unitPrice(task, multiplier));
}
export function workItemAmount(item: { tasks: PricedTask[] }, multiplier = 1) {
  return money(item.tasks.reduce((sum, task) => sum + taskAmount(task, multiplier), 0));
}
/**
 * Amount of a chapter including its subchapters: the following items with a greater depth.
 * Matches the editor, where a parent chapter shows the sum of its whole subtree.
 */
export function workItemSubtreeAmount(
  items: readonly { depth?: number; tasks: PricedTask[] }[],
  index: number,
  multiplier = 1,
) {
  const depth = items[index]?.depth ?? 0;
  let sum = 0;
  for (let i = index; i < items.length; i++) {
    if (i > index && (items[i]!.depth ?? 0) <= depth) break;
    sum += workItemAmount(items[i]!, multiplier);
  }
  return money(sum);
}
export function budgetTotals(budget: PricedBudget) {
  const multiplier = budget.adjustment?.multiplier ?? 1;
  const raw = money(budget.workItems.reduce((sum, item) => sum + workItemAmount(item), 0));
  const lines = money(
    budget.workItems.reduce((sum, item) => sum + workItemAmount(item, multiplier), 0),
  );
  const subtotal = multiplier < 1 ? money(raw * multiplier) : lines;
  const iva = money(subtotal * (budget.ivaRate ?? DEFAULT_IVA_RATE));
  return { raw, subtotal, iva, total: money(subtotal + iva), discount: money(subtotal - raw) };
}
export function budgetCost(items: WorkItem[]) {
  return money(
    items.reduce(
      (sum, item) => sum + item.tasks.reduce((s, task) => s + money(task.quantity * task.cost), 0),
      0,
    ),
  );
}
export function assertBudget(budget: Budget | PublicBudget, publish = false) {
  const rate = budget.ivaRate ?? DEFAULT_IVA_RATE;
  const multiplier = budget.adjustment?.multiplier ?? 1;
  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 1 ||
    !Number.isFinite(multiplier) ||
    multiplier < 0 ||
    multiplier > 11
  )
    throw new Error('Revisa el IVA y el porcentaje de ajuste.');
  let populated = 0;
  for (const item of budget.workItems)
    for (const task of item.tasks) {
      const values = [task.quantity, task.price, ...('cost' in task ? [task.cost] : [])];
      if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0))
        throw new Error('Las cantidades y los precios deben ser números positivos.');
      if (task.description.trim() && task.quantity > 0) populated++;
      else if (publish)
        throw new Error('Completa o elimina las partidas vacías antes de compartir o exportar.');
    }
  if (publish && (!budget.info.clientName.trim() || populated === 0))
    throw new Error('Añade un cliente y al menos una partida antes de compartir o exportar.');
}

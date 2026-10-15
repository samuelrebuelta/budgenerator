import { describe, it, expect } from 'vitest';
import { budgetTotals, assertBudget, decimal, taskAmount } from '../src/shared/lib/budgetMath';
import { toPublicBudget } from '../src/entities/budget/model/publicBudget';
import { budget } from './fixtures';
describe('monetary policy shared by editor, public view and PDF', () => {
  it('preserves fractional quantities and prices and rounds at the line boundary', () => {
    const b = budget();
    expect(taskAmount(b.workItems[0]!.tasks[0]!)).toBe(26.88);
    expect(budgetTotals(b)).toMatchObject({ subtotal: 26.88, iva: 2.69, total: 29.57 });
    expect(decimal('2,5')).toBe(2.5);
    expect(decimal('10.75')).toBe(10.75);
  });
  it('keeps public totals identical after a surcharge is baked into unit prices', () => {
    const b = {
      ...budget(),
      adjustment: { multiplier: 1.15, reason: 'Internal margin' },
      ivaRate: 0.21,
    };
    expect(budgetTotals(toPublicBudget(b))).toEqual(
      budgetTotals({ ...b, adjustment: undefined, workItems: toPublicBudget(b).workItems }),
    );
    expect(budgetTotals(toPublicBudget(b)).total).toBe(budgetTotals(b).total);
  });
  it('allows a free concept and an exact 100% discount', () => {
    const b = budget();
    b.workItems[0]!.tasks[0]!.price = 0;
    expect(() => assertBudget(b, true)).not.toThrow();
    expect(budgetTotals({ ...b, adjustment: { multiplier: 0, reason: '' } }).total).toBe(0);
  });
  it('rejects NaN, negative totals, invalid tax and empty exported lines', () => {
    const b = budget();
    expect(() => assertBudget({ ...b, ivaRate: NaN })).toThrow();
    expect(() => assertBudget({ ...b, adjustment: { multiplier: -0.1, reason: '' } })).toThrow();
    b.workItems[0]!.tasks[0]!.quantity = NaN;
    expect(() => assertBudget(b)).toThrow();
    b.workItems[0]!.tasks[0]!.quantity = 0;
    expect(() => assertBudget(b, true)).toThrow();
  });
});

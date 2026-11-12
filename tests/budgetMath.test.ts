import { describe, it, expect } from 'vitest';
import { budgetTotals, assertBudget, decimal, taskAmount } from '../src/shared/lib/budgetMath';
import { buildSharedBudget, sharedBudgetView } from '../src/entities/budget/model/publicBudget';
import { documentTotals, updateBusiness } from '../src/entities/construction-document/model';
import { budget, budgetRecord } from './fixtures';
describe('monetary policy shared by editor, public view and PDF', () => {
  it('preserves fractional quantities and prices and rounds at the line boundary', () => {
    const b = budget();
    expect(taskAmount(b.workItems[0]!.tasks[0]!)).toBe(26.88);
    expect(budgetTotals(b)).toMatchObject({ subtotal: 26.88, iva: 2.69, total: 29.57 });
    expect(decimal('2,5')).toBe(2.5);
    expect(decimal('10.75')).toBe(10.75);
  });
  it('keeps public totals identical after a surcharge is baked into unit prices', () => {
    const record = budgetRecord();
    record.document = updateBusiness(record.document, {
      adjustment: { multiplier: 1.15, reason: 'Internal margin' },
      ivaRate: 0.21,
    });
    const publicView = sharedBudgetView(
      buildSharedBudget(record, { name: '', cif: '', address: '', phone: '', email: '' }, 'u'),
    );
    expect(publicView.adjustment).toBeUndefined();
    expect(budgetTotals(publicView).total).toBe(documentTotals(record.document).total);
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

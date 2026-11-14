import { describe, it, expect } from 'vitest';
import {
  budgetTotals,
  assertBudget,
  decimal,
  money,
  taskAmount,
  workItemSubtreeAmount,
} from '../src/shared/lib/budgetMath';
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
  it('rounds half-cent amounts like the canonical document (8.5 × 9.79 → 83.22)', () => {
    expect(money(8.5 * 9.79)).toBe(83.22);
    expect(money(1.005)).toBe(1.01);
    expect(money(-1.005)).toBe(-1.01);
    expect(taskAmount({ quantity: 8.5, price: 9.79 })).toBe(83.22);
    const totals = budgetTotals({
      ivaRate: 0.21,
      workItems: [
        { tasks: [{ quantity: 8.5, price: 9.79 }] },
        {
          tasks: [
            { quantity: 12.3, price: 39.07 },
            { quantity: 2, price: 9.79 },
          ],
        },
        { tasks: [{ quantity: 1, price: 68 }] },
      ],
    });
    // Same figures the editor shows for tests/fixtures/bc3/obra-mediciones-850.bc3.
    expect(totals).toMatchObject({ subtotal: 651.36, iva: 136.79, total: 788.15 });
  });
  it('adds subchapters to their parent chapter like the editor', () => {
    const items = [
      { depth: 0, tasks: [{ quantity: 1, price: 68 }] },
      { depth: 0, tasks: [] },
      { depth: 1, tasks: [{ quantity: 8.5, price: 9.79 }] },
      { depth: 0, tasks: [{ quantity: 2, price: 10 }] },
    ];
    expect(workItemSubtreeAmount(items, 0)).toBe(68);
    expect(workItemSubtreeAmount(items, 1)).toBe(83.22);
    expect(workItemSubtreeAmount(items, 2)).toBe(83.22);
    expect(workItemSubtreeAmount(items, 3)).toBe(20);
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

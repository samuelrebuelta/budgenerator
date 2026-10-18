import { it, expect } from 'vitest';
import { toPublicBudget } from '../src/entities/budget/model/publicBudget';
import { budget } from './fixtures';
it('allowlists every public field, including legacy budgets with undefined optional fields', () => {
  const b = { ...budget(), catalogId: undefined, ivaRate: undefined, adjustment: undefined };
  b.sourceLeadId = 'private-lead-id';
  b.workItems[0]!.catalogPartId = 'private-part-id';
  b.workItems[0]!.tasks[0]!.catalogConceptId = 'private-concept-id';
  const publicData = toPublicBudget(b);
  const serialized = JSON.stringify(publicData);
  expect(serialized).not.toContain('cost');
  expect(serialized).not.toContain('catalogId');
  expect(serialized).not.toContain('private-lead-id');
  expect(serialized).not.toContain('private-part-id');
  expect(serialized).not.toContain('private-concept-id');
  expect(publicData.workItems[0]!.tasks[0]).toEqual({
    id: 'task',
    description: 'Pintura de paredes',
    quantity: 2.5,
    unit: 'm2',
    price: 10.75,
  });
  expect(Object.values(publicData)).not.toContain(undefined);
});
it('removes private surcharge metadata while retaining an explicit customer discount', () => {
  const b = budget();
  b.adjustment = { multiplier: 1.2, reason: 'Private overhead' };
  expect(toPublicBudget(b).adjustment).toBeUndefined();
  expect(toPublicBudget(b).workItems[0]!.tasks[0]!.price).toBe(12.9);
  b.adjustment = { multiplier: 0.9, reason: 'Descuento cliente' };
  expect(toPublicBudget(b).adjustment).toEqual(b.adjustment);
});

import { it, expect } from 'vitest';
import { buildSharedBudget, sharedBudgetView } from '../src/budget/publicBudget';
import { updateBusiness, updateItem } from '../src/construction-document/index';
import { budgetRecord } from './fixtures';

const company = { name: 'Estudio', cif: 'B1', address: 'Calle', phone: '600', email: 'a@b.es' };

it('allowlists public fields and strips costs, catalog links and breakdowns', () => {
  const record = budgetRecord('a', { sourceLeadId: 'private-lead-id' });
  const node = record.document.tree[0]!.children[0]!;
  const concept = record.document.concepts[node.conceptId]!;
  concept.source = { catalogConceptId: 'private-concept-id', catalogChapterId: 'private-part-id' };
  const shared = buildSharedBudget(record, company, 'alice', 0);
  const serialized = JSON.stringify(shared);
  expect(serialized).not.toContain('cost');
  expect(serialized).not.toContain('private-lead-id');
  expect(serialized).not.toContain('private-part-id');
  expect(serialized).not.toContain('private-concept-id');
  expect(shared).toMatchObject({ schemaVersion: 3, ownerUid: 'alice', expiresAt: 30 * 86400000 });
  expect(sharedBudgetView(shared).workItems[0]!.tasks[0]).toMatchObject({
    description: 'Pintura de paredes',
    quantity: 2.5,
    unit: 'm2',
    price: 10.75,
  });
});

it('bakes a private surcharge into prices and keeps an explicit customer discount', () => {
  const record = budgetRecord();
  record.document = updateBusiness(record.document, {
    adjustment: { multiplier: 1.2, reason: 'Private overhead' },
  });
  const surcharged = buildSharedBudget(record, company, 'alice');
  expect(JSON.stringify(surcharged)).not.toContain('Private overhead');
  expect(sharedBudgetView(surcharged).workItems[0]!.tasks[0]!.price).toBe(12.9);
  record.document = updateBusiness(record.document, {
    adjustment: { multiplier: 0.9, reason: 'Descuento cliente' },
  });
  expect(sharedBudgetView(buildSharedBudget(record, company, 'alice')).adjustment).toEqual({
    multiplier: 0.9,
    reason: 'Descuento cliente',
  });
});

it('refuses to publish incomplete budgets', () => {
  const record = budgetRecord();
  const node = record.document.tree[0]!.children[0]!;
  record.document = updateItem(record.document, node.id, { quantity: 0 });
  expect(() => buildSharedBudget(record, company, 'alice')).toThrow(/partidas vacías/);
});

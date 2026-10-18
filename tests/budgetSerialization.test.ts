import { expect, it } from 'vitest';
import {
  mapBudgetFromFirestore,
  mapBudgetToFirestore,
} from '../src/entities/budget/model/serialization';
import { budget } from './fixtures';

it('preserves lead linkage and project acceptance fields in Firestore mapping', () => {
  const source = {
    ...budget(),
    sourceLeadId: 'lead-123',
    acceptedAt: '2026-10-18T08:00:00.000Z',
    projectId: 'project-123',
  };

  const stored = mapBudgetToFirestore(source);
  expect(stored.sourceLeadId).toBe('lead-123');
  expect(stored.acceptedAt).toBe(source.acceptedAt);
  expect(stored.projectId).toBe('project-123');
  expect(mapBudgetFromFirestore(stored)).toMatchObject({
    sourceLeadId: 'lead-123',
    acceptedAt: source.acceptedAt,
    projectId: 'project-123',
  });
});

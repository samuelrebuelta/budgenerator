import { expect, it } from 'vitest';
import {
  conceptKey,
  rankPartConcepts,
  structureFromSelection,
} from '../src/features/budget-structure/model';
import type { CatalogPart, Budget } from '../src/shared/types';
import { budget } from './fixtures';

const parts: CatalogPart[] = [
  {
    id: 'paint',
    name: 'Pintura',
    concepts: [
      { id: 'same', description: 'Zócalo', unit: 'ml', basePrice: 20, cost: 8 },
      { id: 'paint-a', description: 'Ángulo', unit: 'm2', basePrice: 15, cost: 6 },
    ],
  },
  {
    id: 'floors',
    name: 'Suelos',
    concepts: [{ id: 'same', description: 'Zócalo', unit: 'ml', basePrice: 30, cost: 12 }],
  },
  { id: 'empty', name: 'Partida vacía', concepts: [] },
];

it('ranks by catalog identity, falls back to legacy snapshots and excludes the current budget', () => {
  const identified: Budget = {
    ...budget('identified'),
    workItems: [
      {
        id: 'w',
        name: 'Pintura',
        catalogPartId: 'paint',
        tasks: [
          {
            id: 't',
            catalogConceptId: 'same',
            description: 'Zócalo',
            unit: 'ml',
            quantity: 2,
            price: 1,
            cost: 0,
          },
          {
            id: 'old-t',
            description: 'Zócalo',
            unit: 'ml',
            quantity: 2,
            price: 1,
            cost: 0,
          },
        ],
      },
    ],
  };
  const legacy: Budget = {
    ...budget('legacy'),
    workItems: [
      {
        id: 'old',
        name: 'Pintura',
        tasks: [
          { id: 'old-task', description: 'ÁNGULO', unit: 'm2', quantity: 1, price: 1, cost: 0 },
        ],
      },
    ],
  };

  const ranked = rankPartConcepts(parts, [identified, legacy], 'new');
  expect(ranked.find((item) => item.partId === 'paint' && item.concept.id === 'same')?.uses).toBe(
    1,
  );
  expect(ranked.find((item) => item.partId === 'floors' && item.concept.id === 'same')?.uses).toBe(
    0,
  );
  expect(ranked.find((item) => item.concept.id === 'paint-a')?.uses).toBe(1);
  expect(rankPartConcepts(parts, [identified], 'identified').every((item) => item.uses === 0)).toBe(
    true,
  );
});

it('builds selected catalog parts with their own concepts and stable source IDs', () => {
  const items = structureFromSelection(
    parts,
    ['floors', 'paint', 'empty'],
    [conceptKey('paint', 'same'), conceptKey('floors', 'same'), conceptKey('paint', 'paint-a')],
  );

  expect(items.map((item) => item.name)).toEqual(['Suelos', 'Pintura']);
  expect(items[0]).toMatchObject({ catalogPartId: 'floors' });
  expect(items[0]?.tasks[0]).toMatchObject({
    catalogConceptId: 'same',
    quantity: 0,
    price: 30,
    cost: 12,
    unit: 'ml',
  });
  expect(items[1]?.tasks.map((task) => task.description)).toEqual(['Ángulo', 'Zócalo']);
  expect(() => structureFromSelection(parts, ['missing'], [])).toThrow();
  expect(() => structureFromSelection(parts, ['paint'], [conceptKey('floors', 'same')])).toThrow();
});

it('uses supplied quantities for selected concepts and leaves the rest incomplete', () => {
  const items = structureFromSelection(
    parts,
    ['paint'],
    [conceptKey('paint', 'same'), conceptKey('paint', 'paint-a')],
    { [conceptKey('paint', 'same')]: 2.5 },
  );

  expect(items[0]?.tasks.map((task) => task.quantity)).toEqual([0, 2.5]);
});

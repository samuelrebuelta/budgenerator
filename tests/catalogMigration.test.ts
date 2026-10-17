import { expect, it } from 'vitest';
import { groupLegacyTariffs } from '../src/entities/catalog/model/migrate';
import type { Tariff } from '../src/shared/types';

const tariff = (id: string, category: string, description = 'Concepto'): Tariff => ({
  id,
  category,
  description,
  unit: 'm2',
  basePrice: 12,
  cost: 6,
});

it('groups legacy tariffs into deterministic parts and preserves concept values', () => {
  const first = groupLegacyTariffs([
    tariff('a', 'Fontanería', 'Tubería'),
    tariff('b', 'Pintura', 'Pared'),
    tariff('c', 'Fontanería', 'Desagüe'),
  ]);
  const second = groupLegacyTariffs([
    tariff('c', 'Fontanería', 'Desagüe'),
    tariff('a', 'Fontanería', 'Tubería'),
    tariff('b', 'Pintura', 'Pared'),
  ]);

  expect(first).toEqual(second);
  expect(first).toHaveLength(2);
  expect(first.find((part) => part.name === 'Fontanería')?.concepts).toMatchObject([
    { id: 'c', description: 'Desagüe', basePrice: 12, cost: 6 },
    { id: 'a', description: 'Tubería', basePrice: 12, cost: 6 },
  ]);
});

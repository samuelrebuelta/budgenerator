import { expect, it } from 'vitest';
import { searchCatalogParts, searchTariffs } from '../src/entities/catalog/model/search';
import type { CatalogPart, Tariff } from '../src/shared/types';
const tariff = (id: string, description: string, category = 'Fontanería'): Tariff => ({
  id,
  description,
  category,
  unit: 'm2',
  basePrice: 12,
  cost: 6,
});

it('searches and sorts concepts inside their identified catalog parts', () => {
  const parts: CatalogPart[] = [
    {
      id: 'paint',
      name: 'Pintura',
      concepts: [
        { id: 'same', description: 'Pintura interior', unit: 'm2', basePrice: 10, cost: 5 },
      ],
    },
    {
      id: 'plumbing',
      name: 'Fontanería',
      concepts: [
        { id: 'same', description: 'Pintura interior', unit: 'm2', basePrice: 11, cost: 6 },
      ],
    },
  ];

  expect(searchCatalogParts(parts, 'fontaneria')).toMatchObject([
    { id: 'plumbing', concepts: [{ id: 'same', basePrice: 11 }] },
  ]);
  expect(searchCatalogParts(parts, 'interior').map((part) => part.id)).toEqual([
    'plumbing',
    'paint',
  ]);
});
it('searches all categories without accents and sorts Spanish names without mutating input', () => {
  const items = [tariff('z', 'Zócalo'), tariff('a', 'Ángulo'), tariff('n', 'Ñudo')];
  expect(searchTariffs(items, '').map((t) => t.id)).toEqual(['a', 'n', 'z']);
  expect(searchTariffs(items, 'angulo').map((t) => t.id)).toEqual(['a']);
  expect(searchTariffs(items, 'FONTANERIA')).toHaveLength(3);
  expect(items[0]?.id).toBe('z');
  expect(searchTariffs(items, 'sin coincidencias')).toEqual([]);
});

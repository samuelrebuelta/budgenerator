import { expect, it } from 'vitest';
import { BASE_CATALOGS, TRADE_CATALOGS } from '../src/entities/catalog/model/baseCatalogs';
import {
  mergeTradeIntoParts,
  type TradeImportScope,
} from '../src/entities/catalog/model/tradeImport';
import type { BaseCatalog } from '../src/entities/catalog/model/baseCatalogs';
import type { CatalogPart } from '../src/shared/types';

it('offers specialist trades and leaves general starter catalogs out of the trade picker', () => {
  expect(TRADE_CATALOGS.map((catalog) => catalog.id)).toContain('albanileria');
  expect(TRADE_CATALOGS.map((catalog) => catalog.id)).toContain('fontaneria');
  expect(TRADE_CATALOGS.map((catalog) => catalog.id)).toContain('electricidad');
  expect(TRADE_CATALOGS).toHaveLength(19);
  expect(TRADE_CATALOGS).not.toContain(BASE_CATALOGS.find((catalog) => catalog.id === 'en_blanco'));
  expect(TRADE_CATALOGS).not.toContain(
    BASE_CATALOGS.find((catalog) => catalog.id === 'reformas_integrales'),
  );
});

it('imports concepts grouped by category, skips existing concepts, and preserves custom values', () => {
  const existing: CatalogPart[] = [
    {
      id: 'custom-plumbing',
      name: 'Fontaneria',
      concepts: [
        {
          id: 'custom-pipe',
          description: 'tuberia',
          unit: 'ml',
          basePrice: 77,
          cost: 44,
        },
      ],
    },
  ];
  const trade: BaseCatalog = {
    id: 'fontaneria',
    name: 'Fontanería',
    description: 'Instalaciones de fontanería y agua',
    tariffs: [
      {
        description: 'Tubería',
        unit: 'ml',
        basePrice: 20,
        cost: 10,
        category: 'Fontanería',
      },
      {
        description: 'Punto de agua sencillo',
        unit: 'unit',
        basePrice: 65,
        cost: 38,
        category: 'Puntos de agua',
      },
    ],
  };
  let nextId = 0;
  const createId = () => `imported-${++nextId}`;

  const firstImport = mergeTradeIntoParts(existing, trade, createId, { type: 'category' });
  const secondImport = mergeTradeIntoParts(firstImport.parts, trade, createId, {
    type: 'category',
  });

  expect(firstImport).toMatchObject({ addedParts: 1, addedConcepts: 1 });
  expect(firstImport.parts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'custom-plumbing',
        name: 'Fontaneria',
        concepts: [
          expect.objectContaining({
            id: 'custom-pipe',
            basePrice: 77,
            cost: 44,
          }),
        ],
      }),
      expect.objectContaining({
        id: 'imported-1',
        name: 'Puntos de agua',
        concepts: [
          expect.objectContaining({
            id: 'imported-2',
            description: 'Punto de agua sencillo',
            basePrice: 65,
            cost: 38,
          }),
        ],
      }),
    ]),
  );
  expect(secondImport).toMatchObject({ addedParts: 0, addedConcepts: 0 });
  expect(existing[0]?.concepts[0]).toMatchObject({ basePrice: 77, cost: 44 });
});

it.each([
  {
    scope: { type: 'part', partName: 'Puntos de agua' } as TradeImportScope,
    expectedParts: ['Puntos de agua'],
    expectedConcepts: ['Punto de agua sencillo'],
  },
  {
    scope: {
      type: 'concept',
      partName: 'Fontanería',
      description: 'Tubería',
      unit: 'ml',
    } as TradeImportScope,
    expectedParts: ['Fontanería'],
    expectedConcepts: ['Tubería'],
  },
])('imports only the selected $scope.type', ({ scope, expectedParts, expectedConcepts }) => {
  const trade: BaseCatalog = {
    id: 'fontaneria',
    name: 'Fontanería',
    description: 'Instalaciones de fontanería y agua',
    tariffs: [
      {
        description: 'Tubería',
        unit: 'ml',
        basePrice: 20,
        cost: 10,
        category: 'Fontanería',
      },
      {
        description: 'Punto de agua sencillo',
        unit: 'unit',
        basePrice: 65,
        cost: 38,
        category: 'Puntos de agua',
      },
    ],
  };
  let nextId = 0;

  const result = mergeTradeIntoParts([], trade, () => `selected-${++nextId}`, scope);

  expect(result.parts.map((part) => part.name)).toEqual(expectedParts);
  expect(
    result.parts.flatMap((part) => part.concepts.map((concept) => concept.description)),
  ).toEqual(expectedConcepts);
  expect(result.addedParts).toBe(expectedParts.length);
  expect(result.addedConcepts).toBe(expectedConcepts.length);
});

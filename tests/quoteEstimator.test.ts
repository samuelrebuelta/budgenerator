import { describe, expect, it } from 'vitest';
import type { CatalogPart } from '../src/shared/types';
import {
  calculateQuoteRange,
  getAvailableEstimatorServices,
  validateEstimatorSettings,
} from '../src/entities/quote-estimator/model/estimate';
import type {
  EstimateSelection,
  QuoteEstimatorSettings,
} from '../src/entities/quote-estimator/model/types';

const catalog: CatalogPart[] = [
  {
    id: 'work',
    name: 'Trabajos',
    concepts: [
      { id: 'paint', description: 'Pintura', unit: 'm2', basePrice: 12, cost: 2 },
      { id: 'tap', description: 'Grifería', unit: 'unit', basePrice: 80, cost: 75 },
      { id: 'wiring', description: 'Electricidad', unit: 'hour', basePrice: 30, cost: 10 },
    ],
  },
];

const selection: EstimateSelection = {
  room: 'bathroom',
  scope: 'partial',
  quality: 'standard',
  areaM2: 8,
};

const settings: QuoteEstimatorSettings = {
  services: [
    {
      room: 'bathroom',
      scope: 'partial',
      quality: 'standard',
      lines: [
        { conceptId: 'paint', minimumQuantity: 1.1, maximumQuantity: 1.3 },
        { conceptId: 'tap', minimumQuantity: 1, maximumQuantity: 1 },
      ],
    },
  ],
  contact: { sharePhone: false, shareEmail: false },
};

describe('public quote estimator calculation', () => {
  it('sums configured lower and upper quantities using basePrice only', () => {
    expect(calculateQuoteRange(settings, catalog, [selection])).toEqual({
      minimumCents: 18560,
      maximumCents: 20480,
      currency: 'EUR',
      includesVat: false,
    });
  });

  it('uses per-area quantities for measured units and fixed quantities per room for unit/hour', () => {
    const mixed: QuoteEstimatorSettings = {
      ...settings,
      services: [
        {
          ...settings.services[0]!,
          lines: [
            { conceptId: 'paint', minimumQuantity: 1, maximumQuantity: 2 },
            { conceptId: 'wiring', minimumQuantity: 2, maximumQuantity: 3 },
          ],
        },
      ],
    };
    expect(calculateQuoteRange(mixed, catalog, [selection])).toEqual({
      minimumCents: 15600,
      maximumCents: 28200,
      currency: 'EUR',
      includesVat: false,
    });
  });

  it('rejects unknown concepts, invalid area, and inverted quantity ranges', () => {
    expect(() =>
      calculateQuoteRange(
        {
          ...settings,
          services: [
            {
              ...settings.services[0]!,
              lines: [{ ...settings.services[0]!.lines[0]!, conceptId: 'missing' }],
            },
          ],
        },
        catalog,
        [selection],
      ),
    ).toThrow('partida sin precio válido');
    expect(() => calculateQuoteRange(settings, catalog, [{ ...selection, areaM2: 0 }])).toThrow(
      'superficie',
    );
    expect(() =>
      calculateQuoteRange(
        {
          ...settings,
          services: [
            {
              ...settings.services[0]!,
              lines: [{ conceptId: 'paint', minimumQuantity: 4, maximumQuantity: 2 }],
            },
          ],
        },
        catalog,
        [selection],
      ),
    ).toThrow('cantidades mínimas');
  });

  it('rejects duplicate service mappings for the same room/scope/quality', () => {
    expect(() =>
      calculateQuoteRange(
        { ...settings, services: [settings.services[0]!, settings.services[0]!] },
        catalog,
        [selection],
      ),
    ).toThrow('misma combinación');
  });

  it('allows multiple partial rooms but reserves integral scope for the whole home', () => {
    const multiRoomSettings: QuoteEstimatorSettings = {
      ...settings,
      services: [
        settings.services[0]!,
        { ...settings.services[0]!, room: 'kitchen' },
        { ...settings.services[0]!, room: 'fullHome', scope: 'integral' },
      ],
    };
    expect(
      calculateQuoteRange(multiRoomSettings, catalog, [
        selection,
        { ...selection, room: 'kitchen' },
      ]),
    ).toEqual({ minimumCents: 37120, maximumCents: 40960, currency: 'EUR', includesVat: false });
    expect(() =>
      calculateQuoteRange(multiRoomSettings, catalog, [
        { ...selection, room: 'fullHome', scope: 'integral' },
        selection,
      ]),
    ).toThrow('no se puede combinar');
    expect(() =>
      validateEstimatorSettings({
        ...settings,
        services: [{ ...settings.services[0]!, scope: 'integral' }],
      }),
    ).toThrow('La reforma integral debe configurarse para la vivienda completa.');
  });

  it('hides mappings removed from the catalog without blocking other valid calculations', () => {
    const settingsWithStaleMapping: QuoteEstimatorSettings = {
      ...settings,
      services: [
        settings.services[0]!,
        {
          room: 'kitchen',
          scope: 'partial',
          quality: 'standard',
          lines: [{ conceptId: 'removed', minimumQuantity: 1, maximumQuantity: 1.5 }],
        },
      ],
    };

    expect(getAvailableEstimatorServices(settingsWithStaleMapping, catalog)).toEqual([
      settings.services[0],
    ]);
    expect(calculateQuoteRange(settingsWithStaleMapping, catalog, [selection])).toEqual({
      minimumCents: 18560,
      maximumCents: 20480,
      currency: 'EUR',
      includesVat: false,
    });
  });
});

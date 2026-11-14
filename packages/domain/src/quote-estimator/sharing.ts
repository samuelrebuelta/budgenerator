import type { ConfigurableEstimateRoom, RoomEstimateRate } from './types.js';

/** Highest price per m² (Lujo included) accepted by the simple estimator: 100.000 €. */
export const MAX_RATE_CENTS_PER_M2 = 10_000_000;

/**
 * Orientative mid-quality prices for a renovation in Spain (labour and materials, without VAT),
 * offered as a starting point. Each professional adjusts them to their own prices.
 */
export const ROOM_REFERENCE_RATES: Record<
  ConfigurableEstimateRoom,
  Omit<RoomEstimateRate, 'room'> & { typicalAreaM2: number }
> = {
  bathroom: {
    minimumCentsPerM2: 70_000,
    maximumCentsPerM2: 110_000,
    qualityStepCentsPerM2: 15_000,
    typicalAreaM2: 5,
  },
  kitchen: {
    minimumCentsPerM2: 60_000,
    maximumCentsPerM2: 100_000,
    qualityStepCentsPerM2: 12_000,
    typicalAreaM2: 10,
  },
  livingRoom: {
    minimumCentsPerM2: 15_000,
    maximumCentsPerM2: 30_000,
    qualityStepCentsPerM2: 5_000,
    typicalAreaM2: 20,
  },
  bedroom: {
    minimumCentsPerM2: 12_000,
    maximumCentsPerM2: 25_000,
    qualityStepCentsPerM2: 4_000,
    typicalAreaM2: 12,
  },
  outdoor: {
    minimumCentsPerM2: 10_000,
    maximumCentsPerM2: 25_000,
    qualityStepCentsPerM2: 4_000,
    typicalAreaM2: 15,
  },
};

/** Problem with one room's prices, written to follow «Baño: …». `null` when it is valid. */
export function roomRateProblem(rate: Omit<RoomEstimateRate, 'room'>): string | null {
  const { minimumCentsPerM2: min, maximumCentsPerM2: max, qualityStepCentsPerM2: step } = rate;
  if (![min, max, step].every(Number.isSafeInteger)) return 'revisa los importes.';
  if (min <= 0 && max <= 0) return 'indica el precio desde y hasta por m².';
  if (min <= 0) return 'indica el precio desde por m².';
  if (max <= 0) return 'indica el precio hasta por m².';
  if (max < min) return 'el precio «desde» no puede ser mayor que el «hasta».';
  if (step < 0) return 'el incremento por nivel no puede ser negativo.';
  if (max + step * 2 > MAX_RATE_CENTS_PER_M2)
    return 'el precio de Lujo supera el máximo de 100.000 €/m².';
  return null;
}

/** Short public links: `/p/{slug}`. */
export const SHORT_LINK_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

/** «Reformas García, S.L.» → «reformas-garcia». Empty when nothing usable is left. */
export function slugifyCompanyName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Legal form at the end: S.L., S.L.U., S.A., S.A.U., S.C., C.B.
    .replace(/[\s,]+(s\.?\s?l\.?\s?u?\.?|s\.?\s?a\.?\s?u?\.?|s\.?\s?c\.?|c\.?\s?b\.?)\s*$/u, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return SHORT_LINK_SLUG_PATTERN.test(slug) ? slug : '';
}

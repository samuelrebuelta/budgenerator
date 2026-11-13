import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ROOM_REFERENCE_RATES,
  SHORT_LINK_SLUG_PATTERN,
  roomRateProblem,
  slugifyCompanyName,
} from '../src/entities/quote-estimator/model/sharing';
import { validateEstimatorSettings } from '../src/entities/quote-estimator/model/estimate';
import {
  clearEstimatorDraft,
  readEstimatorDraft,
  writeEstimatorDraft,
} from '../src/pages/quote-estimator/model/estimatorDraft';
import {
  missingRequirements,
  hostedNoticePath,
  websiteButtonHtml,
  whatsappShareUrl,
} from '../src/pages/quote-estimator/model/estimatorSharing';

const rate = (min: number, max: number, step = 0) => ({
  minimumCentsPerM2: min,
  maximumCentsPerM2: max,
  qualityStepCentsPerM2: step,
});

describe('room price problems', () => {
  it('names the field that needs attention', () => {
    expect(roomRateProblem(rate(0, 0))).toBe('indica el precio desde y hasta por m².');
    expect(roomRateProblem(rate(0, 900))).toBe('indica el precio desde por m².');
    expect(roomRateProblem(rate(600, 0))).toBe('indica el precio hasta por m².');
    expect(roomRateProblem(rate(900, 600))).toBe(
      'el precio «desde» no puede ser mayor que el «hasta».',
    );
    expect(roomRateProblem(rate(600, 900, -1))).toBe(
      'el incremento por nivel no puede ser negativo.',
    );
    expect(roomRateProblem(rate(100, 9_000_000, 1_000_000))).toMatch(/Lujo supera/);
    expect(roomRateProblem(rate(600, 900, 100))).toBeNull();
  });

  it('prefixes the room in the settings validation', () => {
    expect(() =>
      validateEstimatorSettings({
        schemaVersion: 2,
        rooms: [{ room: 'kitchen', ...rate(900, 600) }],
        contact: { sharePhone: false, shareEmail: false },
      }),
    ).toThrow('Cocina: el precio «desde» no puede ser mayor que el «hasta».');
  });

  it('offers valid reference prices for every configurable room', () => {
    for (const reference of Object.values(ROOM_REFERENCE_RATES)) {
      expect(roomRateProblem(reference)).toBeNull();
      expect(reference.typicalAreaM2).toBeGreaterThan(0);
    }
  });
});

describe('short link slugs', () => {
  it('turns a company name into a readable slug', () => {
    expect(slugifyCompanyName('Reformas García, S.L.')).toBe('reformas-garcia');
    expect(slugifyCompanyName('  Pintura & Decoración Ñandú SA ')).toBe('pintura-decoracion-nandu');
    expect(slugifyCompanyName('Obras 2026 S.L.U.')).toBe('obras-2026');
    expect(slugifyCompanyName('***')).toBe('');
    expect(slugifyCompanyName('x'.repeat(80))).toHaveLength(40);
  });

  it('only accepts lowercase slugs without edge hyphens', () => {
    expect(SHORT_LINK_SLUG_PATTERN.test('reformas-garcia-2')).toBe(true);
    for (const slug of ['-a', 'a-', 'A', '../x', 'a', 'reformas_garcia'])
      expect(SHORT_LINK_SLUG_PATTERN.test(slug)).toBe(false);
  });
});

describe('estimator draft', () => {
  const storage = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
  afterEach(() => storage.clear());

  const settings = {
    schemaVersion: 2 as const,
    rooms: [{ room: 'bathroom' as const, ...rate(60_000, 90_000, 10_000) }],
    contact: { sharePhone: true, shareEmail: false },
  };

  it('keeps unsaved settings per user and clears them after saving', () => {
    writeEstimatorDraft('ana', { settings, step: 1 });
    expect(readEstimatorDraft('ana')).toEqual({ settings, step: 1 });
    expect(readEstimatorDraft('luis')).toBeNull();
    clearEstimatorDraft('ana');
    expect(readEstimatorDraft('ana')).toBeNull();
  });

  it('ignores corrupted drafts and clamps the step', () => {
    storage.set('budgenerator:estimator-draft:ana', '{not json');
    expect(readEstimatorDraft('ana')).toBeNull();
    storage.set('budgenerator:estimator-draft:ana', JSON.stringify({ settings, step: 9 }));
    expect(readEstimatorDraft('ana')?.step).toBe(2);
  });
});

describe('sharing helpers', () => {
  it('lists every missing requirement at once', () => {
    expect(
      missingRequirements({ emailVerified: false, companyName: false, privacyNotice: false }),
    ).toEqual([
      'verifica tu email',
      'añade el nombre de tu empresa',
      'añade un aviso de privacidad',
    ]);
    expect(
      missingRequirements({ emailVerified: true, companyName: true, privacyNotice: true }),
    ).toEqual([]);
  });

  it('recognizes hosted notices only on their exact path', () => {
    expect(
      hostedNoticePath('https://budgenerator.web.app/aviso-privacidad/abcdefghijklmnopqrstuv'),
    ).toBe('/aviso-privacidad/abcdefghijklmnopqrstuv');
    expect(hostedNoticePath('https://example.com/privacidad')).toBeNull();
    expect(hostedNoticePath('no es una url')).toBeNull();
  });

  it('builds share links and a script-free website button', () => {
    const url = 'https://budgenerator.web.app/p/reformas-garcia';
    expect(decodeURIComponent(whatsappShareUrl('Reformas García', url))).toContain(url);
    const html = websiteButtonHtml(url);
    expect(html).toContain(`href="${url}"`);
    expect(html).not.toMatch(/<script|on\w+=/i);
  });
});

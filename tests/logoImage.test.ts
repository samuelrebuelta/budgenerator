import { describe, expect, it } from 'vitest';
import { encodeLogo, fitWithin, LOGO_MAX_DATA_URL_LENGTH } from '@/shared/lib/logoImage';

describe('logo compression', () => {
  it('fits the longest side into 400 px without upscaling', () => {
    expect(fitWithin(1600, 800)).toEqual({ width: 400, height: 200 });
    expect(fitWithin(300, 1200)).toEqual({ width: 100, height: 400 });
    expect(fitWithin(120, 80)).toEqual({ width: 120, height: 80 });
  });

  it('prefers WebP and lowers quality until it fits', () => {
    const calls: string[] = [];
    const result = encodeLogo((type, quality) => {
      calls.push(`${type}@${quality}`);
      const size = quality >= 0.8 ? LOGO_MAX_DATA_URL_LENGTH + 1 : 1000;
      return `data:${type};base64,${'A'.repeat(size)}`;
    });
    expect(result.startsWith('data:image/webp;')).toBe(true);
    expect(calls).toEqual(['image/webp@0.9', 'image/webp@0.8', 'image/webp@0.7']);
  });

  it('falls back to JPEG when the browser cannot encode WebP', () => {
    const result = encodeLogo((type) =>
      type === 'image/webp' ? 'data:image/png;base64,AAAA' : 'data:image/jpeg;base64,AAAA',
    );
    expect(result).toBe('data:image/jpeg;base64,AAAA');
  });

  it('rejects images that never fit the Firestore budget', () => {
    expect(() =>
      encodeLogo((type) => `data:${type};base64,${'A'.repeat(LOGO_MAX_DATA_URL_LENGTH + 10)}`),
    ).toThrow();
  });
});

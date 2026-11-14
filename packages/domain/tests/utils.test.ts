import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateId, setIdGenerator } from '../src/lib/utils';

describe('generateId', () => {
  afterEach(() => setIdGenerator(undefined));

  it('uses globalThis.crypto.randomUUID by default', () => {
    expect(generateId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uses the injected generator on platforms without Web Crypto', () => {
    setIdGenerator(() => 'fixed-id');
    expect(generateId()).toBe('fixed-id');
  });

  it('fails clearly when no generator is available', () => {
    vi.stubGlobal('crypto', undefined);
    try {
      expect(() => generateId()).toThrow(/setIdGenerator/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

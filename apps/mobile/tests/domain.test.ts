import { budgetTotals, formatEuros, generateId, setIdGenerator } from '@bg/domain';
import { colors } from '@bg/ui-tokens';
import { missingRuntimeGlobals, runtimeSelfCheck } from '../src/platform/runtime';

describe('@bg/domain desde la app', () => {
  it('calcula los mismos importes que la web', () => {
    // 8,5 × 9,79 = 83,215 → 83,22 (redondeo de budgetMath) + 10 % de IVA.
    const totals = budgetTotals({ workItems: [{ tasks: [{ quantity: 8.5, price: 9.79 }] }] });
    expect(totals).toEqual({ raw: 83.22, subtotal: 83.22, iva: 8.32, total: 91.54, discount: 0 });
    expect(formatEuros(totals.total)).toMatch(/91,54/);
  });

  it('usa el generador de identificadores registrado por la plataforma', () => {
    const crypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      setIdGenerator(() => 'id-native');
      expect(generateId()).toBe('id-native');
    } finally {
      setIdGenerator(undefined);
      Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true });
    }
  });

  it('resuelve @bg/ui-tokens', () => {
    expect(colors.primary).toBe('#24564c');
  });

  it('detecta globales ausentes y los comprueba en el motor', () => {
    expect(missingRuntimeGlobals({ URL, Intl })).toEqual([
      'structuredClone',
      'TextEncoder',
      'TextDecoder',
      'URLSearchParams',
      'atob',
      'btoa',
    ]);
    const failed = runtimeSelfCheck().filter((item) => !item.ok && item.name !== 'generateId');
    expect(failed).toEqual([]);
  });
});

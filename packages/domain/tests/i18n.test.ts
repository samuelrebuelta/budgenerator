import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/index';

describe('t', () => {
  it('returns Spanish copy, plural forms and interpolated values', () => {
    expect(t('budgets.count', { count: 1 })).toBe('1 presupuesto');
    expect(t('budgets.count', { count: 3 })).toBe('3 presupuestos');
    expect(t('budgets.budgetsUsed', { used: 2, limit: 3 })).toContain('2');
  });

  it('falls back to the key for unknown entries', () => {
    expect(t('missing.key')).toBe('missing.key');
  });
});

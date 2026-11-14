import { describe, expect, it } from 'vitest';
import {
  formatCents,
  formatDate,
  formatDateTime,
  formatEuros,
  formatQuantity,
} from '../src/lib/format';

const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('format', () => {
  it('formats euros, cents and quantities in Spanish', () => {
    expect(normalize(formatEuros(1234.5))).toBe('1234,50 €');
    expect(normalize(formatCents(123450))).toBe('1234,50 €');
    expect(formatQuantity(10.5)).toBe('10,5');
    expect(normalize(formatEuros(Number.NaN))).toBe('0,00 €');
  });

  it('reads date keys as local days and handles invalid dates', () => {
    expect(formatDate('2026-10-14')).toBe('14 oct 2026');
    expect(formatDate('not a date')).toBe('Fecha no disponible');
    expect(formatDateTime('nope', '—')).toBe('—');
  });
});

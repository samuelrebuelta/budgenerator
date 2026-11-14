import { describe, expect, it } from 'vitest';
import {
  applySpanishGrouping,
  formatCents,
  formatDate,
  formatDateTime,
  formatEuros,
  formatNumber,
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

  it('groups thousands like CLDR es-ES on every engine (Hermes on Android groups 4 digits)', () => {
    expect(normalize(formatEuros(9999.99))).toBe('9999,99 €');
    expect(normalize(formatEuros(12345.5))).toBe('12.345,50 €');
    expect(formatNumber(1234.5, { minimumFractionDigits: 2 })).toBe('1234,50');
    // Android output, normalised to the web's.
    expect(applySpanishGrouping('1.234,50 €')).toBe('1234,50 €');
    expect(applySpanishGrouping('-1.234,50 €')).toBe('-1234,50 €');
    expect(applySpanishGrouping('1.234')).toBe('1234');
    expect(applySpanishGrouping('12.345,50 €')).toBe('12.345,50 €');
    expect(applySpanishGrouping('1.234.567,00 €')).toBe('1.234.567,00 €');
    expect(applySpanishGrouping('Total: 1.234,50 € y 2.000 €')).toBe('Total: 1234,50 € y 2000 €');
  });

  it('reads date keys as local days and handles invalid dates', () => {
    expect(formatDate('2026-10-14')).toBe('14 oct 2026');
    expect(formatDate('not a date')).toBe('Fecha no disponible');
    expect(formatDateTime('nope', '—')).toBe('—');
  });
});

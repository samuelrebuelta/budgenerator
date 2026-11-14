import type { DecimalText } from './types.js';

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** True when the text is a FIEBDC decimal (dot separator). Empty text is not a number. */
export function isDecimalText(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

/** Parses a decimal lexeme. Returns `fallback` for empty text and `null` for invalid text. */
export function parseDecimal(
  value: DecimalText | undefined,
  fallback: number | null = null,
): number | null {
  const text = value?.trim() ?? '';
  if (!text) return fallback;
  if (!DECIMAL_PATTERN.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Accepts user input with a comma or a dot as decimal separator. */
export function parseUserDecimal(value: string): number | null {
  return parseDecimal(value.trim().replace(',', '.'));
}

/** Rounds half away from zero using decimal exponent shifting (1.005 → 1.01). */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  // Drop binary noise first (8.5 * 9.79 = 83.21499999999999 must round to 83.22).
  const clean = Number(Math.abs(value).toPrecision(15));
  const shifted = Number(`${clean}e${decimals}`);
  const rounded = Number(`${Math.round(shifted)}e-${decimals}`);
  return sign * rounded || 0;
}

export const money = (value: number) => roundTo(value, 2);

/** Canonical lexeme for a number: plain notation, no exponent, trailing zeros removed. */
export function formatDecimal(value: number, maxDecimals = 6): DecimalText {
  if (!Number.isFinite(value)) throw new Error('No se puede guardar un número no finito.');
  const rounded = roundTo(value, maxDecimals);
  if (Object.is(rounded, -0) || rounded === 0) return '0';
  const text = rounded.toFixed(maxDecimals);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** Fixed-decimal lexeme used for prices written by the app (12.5 → "12.50"). */
export function formatFixed(value: number, decimals = 2): DecimalText {
  return roundTo(value, decimals).toFixed(decimals);
}

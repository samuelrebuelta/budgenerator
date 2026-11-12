import { parseDecimal } from './decimal.js';
import type { FiebdcMeasurement, FiebdcMeasurementLine } from './types.js';

type Variables = Record<'a' | 'b' | 'c' | 'd', number>;

/**
 * Evaluates a FIEBDC measurement expression (line type 3). Supported: numbers, the variables
 * a/b/c/d (units, length, width, height), + - * / ^, parentheses and unary signs.
 * Returns null for anything else, so unknown syntax is never guessed.
 */
export function evaluateMeasurementExpression(
  expression: string,
  variables: Variables,
): number | null {
  const source = expression.replace(/\s+/g, '').toLowerCase();
  let index = 0;
  const peek = () => source[index];
  const parseExpression = (): number | null => {
    let left = parseTerm();
    while (left !== null && (peek() === '+' || peek() === '-')) {
      const operator = source[index++];
      const right = parseTerm();
      if (right === null) return null;
      left = operator === '+' ? left + right : left - right;
    }
    return left;
  };
  const parseTerm = (): number | null => {
    let left = parsePower();
    while (left !== null && (peek() === '*' || peek() === '/')) {
      const operator = source[index++];
      const right = parsePower();
      if (right === null) return null;
      if (operator === '/' && right === 0) return null;
      left = operator === '*' ? left * right : left / right;
    }
    return left;
  };
  const parsePower = (): number | null => {
    const base = parseUnary();
    if (base === null || peek() !== '^') return base;
    index++;
    const exponent = parsePower();
    return exponent === null ? null : base ** exponent;
  };
  const parseUnary = (): number | null => {
    if (peek() === '-' || peek() === '+') {
      const sign = source[index++] === '-' ? -1 : 1;
      const value = parseUnary();
      return value === null ? null : sign * value;
    }
    return parsePrimary();
  };
  const parsePrimary = (): number | null => {
    const character = peek();
    if (character === undefined) return null;
    if (character === '(') {
      index++;
      const value = parseExpression();
      if (peek() !== ')') return null;
      index++;
      return value;
    }
    if (character in variables) {
      index++;
      return variables[character as keyof Variables];
    }
    const match = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)/.exec(source.slice(index));
    if (!match) return null;
    index += match[0].length;
    return Number(match[0].replace(',', '.'));
  };
  if (!source) return null;
  const value = parseExpression();
  if (value === null || index !== source.length || !Number.isFinite(value)) return null;
  return value;
}

/** Contribution of one measurement line, or null when it contains invalid numbers. */
export function measurementLineValue(line: FiebdcMeasurementLine): number | null {
  if (line.type === '1' || line.type === '2') return 0;
  const factors = [line.units, line.length, line.width, line.height];
  const parsed = factors.map((value) => (value?.trim() ? parseDecimal(value) : undefined));
  if (parsed.some((value) => value === null)) return null;
  if (line.type === '3') {
    const [a, b, c, d] = parsed.map((value) => value ?? 0) as [number, number, number, number];
    return evaluateMeasurementExpression(line.comment, { a, b, c, d });
  }
  const present = parsed.filter((value): value is number => typeof value === 'number');
  if (!present.length) return 0;
  return present.reduce((product, value) => product * value, 1);
}

/** Total of the measurement lines, or null when a line cannot be evaluated. */
export function measurementLinesTotal(measurement: FiebdcMeasurement): number | null {
  let total = 0;
  for (const line of measurement.lines) {
    const value = measurementLineValue(line);
    if (value === null) return null;
    total += value;
  }
  return total;
}

/** Running values used to display subtotal lines. */
export function measurementRunningValues(measurement: FiebdcMeasurement): (number | null)[] {
  let partial = 0;
  let running = 0;
  return measurement.lines.map((line) => {
    if (line.type === '1') {
      const value = partial;
      partial = 0;
      return value;
    }
    if (line.type === '2') return running;
    const value = measurementLineValue(line);
    if (value !== null) {
      partial += value;
      running += value;
    }
    return value;
  });
}

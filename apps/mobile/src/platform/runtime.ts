import { budgetTotals, formatEuros, generateId } from '@bg/domain';

/**
 * Web-standard globals that `@bg/domain` relies on (packages/domain/src/runtime-globals.d.ts).
 * Expo's runtime installs `URL`, `URLSearchParams` and `structuredClone`; Hermes ships
 * `TextEncoder`/`TextDecoder` (UTF-8 only; the windows-1252 BC3 import stays on the web).
 */
const REQUIRED_GLOBALS = [
  'structuredClone',
  'TextEncoder',
  'TextDecoder',
  'URL',
  'URLSearchParams',
  'Intl',
  // jsPDF (`buildBudgetDocument`) encodes with them; React Native installs both.
  'atob',
  'btoa',
] as const;

export function missingRuntimeGlobals(scope: object = globalThis): string[] {
  const record = scope as Record<string, unknown>;
  return REQUIRED_GLOBALS.filter((name) => typeof record[name] === 'undefined');
}

export interface RuntimeCheck {
  name: string;
  ok: boolean;
  detail: string;
}

function check(name: string, run: () => [boolean, string]): RuntimeCheck {
  try {
    const [ok, detail] = run();
    return { name, ok, detail };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Exercises the globals and `@bg/domain` on the real engine (Hermes in the dev client). Shown on
 * the development login so a missing polyfill is visible after an Expo or React Native upgrade.
 */
export function runtimeSelfCheck(): RuntimeCheck[] {
  return [
    check('structuredClone', () => {
      const source = { items: [{ quantity: 2 }], at: new Date(0) };
      const copy = structuredClone(source);
      return [copy !== source && copy.items[0]?.quantity === 2 && copy.at instanceof Date, 'ok'];
    }),
    check('TextEncoder', () => {
      const bytes = new TextEncoder().encode('Añadir €').length;
      return [bytes === 11, `${bytes} bytes`];
    }),
    check('TextDecoder', () => {
      const text = new TextDecoder().decode(new TextEncoder().encode('ñ'));
      return [text === 'ñ', text];
    }),
    check('URL', () => {
      const url = new URL('/profile/solicitudes?leadId=l1', 'https://budgenerator.web.app');
      return [
        url.searchParams.get('leadId') === 'l1' && url.pathname === '/profile/solicitudes',
        url.href,
      ];
    }),
    check('Intl es-ES', () => {
      const total = budgetTotals({
        workItems: [{ tasks: [{ quantity: 8.5, price: 9.79 }] }],
      }).total;
      const text = formatEuros(total);
      return [total === 91.54 && text.includes('91,54'), text];
    }),
    check('Intl agrupación es-ES', () => {
      // Same as Node/ICU (web and the PDF reference): no separator below 10.000.
      const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
      const text = `${(1234.5).toLocaleString('es-ES', options)} | ${(12345.5).toLocaleString('es-ES', options)}`;
      return [text === '1234,50 | 12.345,50', text];
    }),
    check('Intl.PluralRules', () => {
      const rules = new Intl.PluralRules('es-ES');
      return [rules.select(1) === 'one' && rules.select(2) === 'other', rules.select(1)];
    }),
    check('atob/btoa', () => {
      const encoded = btoa('%PDF-1.3');
      return [atob(encoded) === '%PDF-1.3', encoded];
    }),
    check('generateId', () => {
      const id = generateId();
      return [/^[0-9a-f-]{36}$/i.test(id), id.slice(0, 8)];
    }),
  ];
}

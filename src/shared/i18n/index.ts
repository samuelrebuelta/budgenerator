import es from '../../../public/locales/es/translation.json';

/**
 * Transitional Spanish copy lookup.
 *
 * BudGenerator only ships in Spanish, so i18next was retired: new UI writes its copy in
 * Spanish directly (grouped in `copy.ts` constants when repeated). Existing `t()` keys keep
 * working with this tiny, synchronous lookup until the remaining pages inline their texts.
 */
type Messages = Record<string, Record<string, string>>;
export type TranslationValues = Record<string, string | number | undefined>;

const messages = es as Messages;
const plural = new Intl.PluralRules('es');

function lookup(key: string): string | undefined {
  const dot = key.indexOf('.');
  if (dot < 0) return undefined;
  return messages[key.slice(0, dot)]?.[key.slice(dot + 1)];
}

export function t(key: string, values?: TranslationValues): string {
  const count = values?.count;
  const template =
    (typeof count === 'number' ? lookup(`${key}_${plural.select(count)}`) : undefined) ??
    lookup(key) ??
    key;
  if (!values) return template;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

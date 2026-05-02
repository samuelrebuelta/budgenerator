type Translations = Record<string, Record<string, string>>;

let translations: Translations = {};
let loaded = false;
const listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export async function loadTranslations(locale = 'es'): Promise<void> {
  const res = await fetch(`/assets/i18n/${locale}.json`);
  translations = await res.json();
  loaded = true;
  notifyListeners();
}

export function onTranslationsLoaded(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function isLoaded(): boolean {
  return loaded;
}

/** Simple interpolation: replaces {0}, {1}, etc. */
function interpolate(template: string, args: Array<string | number>): string {
  return args.reduce<string>(
    (result, val, i) => result.replace(new RegExp(`\\{${i}\\}`, 'g'), String(val)),
    template,
  );
}

/** Get a raw string from the translations (no interpolation). */
function get(section: string, key: string): string {
  return translations[section]?.[key] ?? `${section}.${key}`;
}

/**
 * Get a translated string with optional interpolation args.
 * For plural keys, pass the count as the first arg — it will
 * pick `key_one` or `key_other` based on count === 1.
 */
function tr(section: string, key: string, ...args: Array<string | number>): string {
  const oneKey = `${key}_one`;
  const otherKey = `${key}_other`;
  if (translations[section]?.[oneKey] !== undefined) {
    const count = typeof args[0] === 'number' ? args[0] : 1;
    const template = count === 1 ? get(section, oneKey) : get(section, otherKey);
    return interpolate(template, args);
  }

  const template = get(section, key);
  return args.length > 0 ? interpolate(template, args) : template;
}

// Proxy-based `t` so `t.section.key` and `t.section.key(arg)` both work.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TranslationSection = Record<string, any>;

function createSectionProxy(section: string): TranslationSection {
  return new Proxy({} as TranslationSection, {
    get(_target, key: string) {
      const raw = get(section, key);
      const hasPlural = translations[section]?.[`${key}_one`] !== undefined;
      const hasInterpolation = raw.includes('{0}') || hasPlural;

      if (hasInterpolation) {
        const fn = (...args: Array<string | number>) => tr(section, key, ...args);
        fn.toString = () => raw;
        return fn;
      }

      return raw;
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const t: Record<string, any> = new Proxy({} as Record<string, TranslationSection>, {
  get(_target, section: string) {
    return createSectionProxy(section);
  },
});

/** Lower-cases and strips accents so Spanish search ignores case and diacritics. */
export const normalizeCatalogText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
export const compareSpanish = (a: string, b: string) =>
  a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });

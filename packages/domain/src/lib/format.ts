/** Spanish (es-ES) formatters shared by every screen. Keep UI formatting here. */
export const APP_LOCALE = 'es-ES';

const euroFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});
const roundedEuroFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const quantityFormatter = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: 'percent',
  maximumFractionDigits: 0,
});

/**
 * es-ES only groups thousands from five integer digits (CLDR `minimumGroupingDigits: 2`): Node,
 * browsers and Hermes on iOS print «1234,50», but Hermes on Android prints «1.234,50» (BG-014,
 * phase 0 spike). Drops the separator of a lone four-digit integer part so every engine prints
 * the same amounts as the web and the reference PDF; on engines that already follow CLDR it is a
 * no-op.
 */
export function applySpanishGrouping(text: string): string {
  return text.replace(/(^|[^\d.,])(\d)\.(\d{3})(?![\d.])/g, '$1$2$3');
}

/** `toLocaleString('es-ES', options)` with the same grouping on every engine. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return applySpanishGrouping(value.toLocaleString(APP_LOCALE, options));
}

/** 1234.5 → «1234,50 €». */
export function formatEuros(value: number): string {
  return applySpanishGrouping(euroFormatter.format(Number.isFinite(value) ? value : 0));
}

/** Whole euros without decimals: 1234.5 → «1235 €». */
export function formatRoundedEuros(value: number): string {
  return applySpanishGrouping(roundedEuroFormatter.format(Number.isFinite(value) ? value : 0));
}

/** Integer cents → euros: 123450 → «1234,50 €». */
export function formatCents(cents: number): string {
  return formatEuros(cents / 100);
}

/** 10.5 → «10,5». */
export function formatQuantity(value: number): string {
  return applySpanishGrouping(quantityFormatter.format(Number.isFinite(value) ? value : 0));
}

/** 0.42 → «42 %». */
export function formatPercent(ratio: number): string {
  return applySpanishGrouping(percentFormatter.format(Number.isFinite(ratio) ? ratio : 0));
}

type DateInput = string | number | Date;

function toDate(value: DateInput): Date | null {
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWith(options: Intl.DateTimeFormatOptions) {
  const formatter = new Intl.DateTimeFormat(APP_LOCALE, options);
  return (value: DateInput, fallback = 'Fecha no disponible') => {
    const date = toDate(value);
    return date ? formatter.format(date) : fallback;
  };
}

/** «14 oct 2026». Date-only keys (YYYY-MM-DD) are read as local dates. */
export const formatDate = formatWith({ dateStyle: 'medium' });
/** «14 de octubre de 2026». */
export const formatLongDate = formatWith({ dateStyle: 'long' });
/** «14 oct 2026, 10:00». */
export const formatDateTime = formatWith({ dateStyle: 'medium', timeStyle: 'short' });

/** Units are free FIEBDC literals. These are the ones the app offers and labels. */
export const KNOWN_UNITS = ['m2', 'm3', 'ml', 'ud', 'h'] as const;
export type KnownUnit = (typeof KNOWN_UNITS)[number];
export type Unit = string;

export const UNIT_LABELS: Record<KnownUnit, string> = {
  m2: 'M²',
  m3: 'M³',
  ml: 'ML',
  ud: 'Ud.',
  h: 'Hr',
};

/** Legacy app identifiers (`unit`, `hour`) mapped to the literal units used in BC3. */
const LEGACY_UNITS: Record<string, KnownUnit> = { unit: 'ud', hour: 'h' };

export function normalizeUnit(unit: string): Unit {
  const trimmed = unit.trim();
  return LEGACY_UNITS[trimmed] ?? trimmed;
}

export function isKnownUnit(unit: string): unit is KnownUnit {
  return (KNOWN_UNITS as readonly string[]).includes(unit);
}

/** Known units keep their short labels; free units are displayed literally. */
export function unitLabel(unit: string): string {
  return isKnownUnit(unit) ? UNIT_LABELS[unit] : unit;
}

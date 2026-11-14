/*
 * BudGenerator design tokens: the single source of truth.
 *
 * - Web: `scripts/build-theme.mjs` generates the Tailwind `@theme` block
 *   (`src/app/styles/theme.generated.css`) from this file. Do not edit that file by hand.
 * - Native: React Native reads these objects directly (`StyleSheet` + tokens, see `native.ts`).
 *
 * Formats are the intersection of CSS and React Native: colours are `#rgb`, `#rrggbb` or
 * `#rrggbbaa` (RN does not understand `oklch()`, `color-mix()` or the space-separated `rgb()`),
 * lengths are plain numbers in px (CSS output converts them to rem), shadows are structured data.
 * The web has no `oklch` today, so no separate native equivalent is needed; if one is ever
 * introduced, keep the hex form here and derive the CSS-only syntax in `css.ts`.
 */

/** A group of colour tokens with the comment that heads it in the generated CSS. */
export interface ColorGroup {
  readonly comment: string;
  readonly values: Readonly<Record<string, string>>;
}

const brand = {
  'brand-50': '#edf5f1',
  'brand-100': '#dcece4',
  'brand-200': '#bad7ca',
  'brand-300': '#8cb7a5',
  'brand-400': '#639783',
  'brand-500': '#367760',
  'brand-600': '#24564c',
  'brand-700': '#183e3b',
  'brand-800': '#12322f',
  'brand-900': '#102d2b',
} as const;

/** Steps of the brand scale, also used by the deprecated `blue-*` alias. */
export const brandSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const neutral = {
  white: '#fffdf8',
  'gray-50': '#faf9f6',
  'gray-100': '#f5f2eb',
  'gray-200': '#e5e1d8',
  'gray-300': '#d0cbc0',
  'gray-400': '#646f69',
  'gray-500': '#5d6962',
  'gray-600': '#52625a',
  'gray-700': '#354b42',
  'gray-800': '#253c34',
  'gray-900': '#1c3029',
} as const;

const surfaces = {
  canvas: '#f5f2eb',
  surface: '#fffdf8',
  'surface-muted': '#faf9f6',
  sidebar: '#ece9df',
  tint: '#edf1e6',
  'tint-strong': '#e8ede2',
  ink: '#1c3029',
  'ink-strong': '#183e3b',
  'ink-soft': '#354b42',
  'ink-muted': '#52625a',
  'ink-subtle': '#5d6962',
  line: '#e5e1d8',
  'line-strong': '#d0cbc0',
  scrim: '#102d2b88',
} as const;

const actions = {
  primary: '#24564c',
  'primary-hover': '#183e3b',
  'on-primary': '#fffdf8',
  accent: '#c65d3b',
  'accent-strong': '#a94c2f',
  focus: '#c65d3b',
  highlight: '#d6e9b9',
} as const;

/** Granate of the selected day in the team calendar. */
const calendar = { 'calendar-selected': '#561321' } as const;

const accentTint = {
  'accent-surface': '#f8eae4',
  'accent-line': '#dfb39f',
} as const;

const crew = {
  'crew-blue': '#367760',
  'crew-blue-surface': '#dcece4',
  'crew-blue-ink': '#183e3b',
  'crew-green': '#648b43',
  'crew-green-surface': '#e3edd7',
  'crew-green-ink': '#354b27',
  'crew-amber': '#b4771e',
  'crew-amber-surface': '#f5e7cd',
  'crew-amber-ink': '#68420d',
  'crew-rose': '#b45e67',
  'crew-rose-surface': '#f4e0df',
  'crew-rose-ink': '#733a3e',
  'crew-violet': '#8062a6',
  'crew-violet-surface': '#ebe4f2',
  'crew-violet-ink': '#514069',
  'crew-cyan': '#3b8e94',
  'crew-cyan-surface': '#d9eceb',
  'crew-cyan-ink': '#28575a',
  'crew-slate': '#68756e',
  'crew-slate-surface': '#e5e7e4',
  'crew-slate-ink': '#3f4844',
} as const;

const states = {
  'success-surface': '#edf5f1',
  'success-line': '#bad7ca',
  'success-ink': '#1d6b4f',
  'warning-surface': '#fdf6e3',
  'warning-line': '#ecd9a6',
  'warning-ink': '#7a4f00',
  'danger-surface': '#fff0e9',
  'danger-line': '#edc4b3',
  'danger-ink': '#9a3926',
  'danger-solid': '#a63d2a',
  'info-surface': '#eef4f8',
  'info-line': '#c5d9e6',
  'info-ink': '#2f6690',
} as const;

/** Colour groups in the order (and with the comments) of the generated `@theme`. */
export const colorGroups: readonly ColorGroup[] = [
  { comment: 'Brand scale: petróleo (docs/archive/design-proposal.md).', values: brand },
  {
    comment: 'Warm neutral scale (cal, papel). 400 and 500 meet 4.5:1 on cal and papel.',
    values: neutral,
  },
  { comment: 'Surfaces and text.', values: surfaces },
  {
    comment:
      'Actions. Terracota is decorative (brand dot, focus ring); use accent-strong for text.',
    values: actions,
  },
  { comment: 'Granate of the selected day in the team calendar.', values: calendar },
  { comment: 'Accent tint for in-progress states (terracota family).', values: accentTint },
  {
    comment:
      'Crew palette (team calendar, project assignments): dot, `-surface` fill, `-ink` text.',
    values: crew,
  },
  {
    comment: 'States: `*-surface` background, `*-line` border, `*-ink` text (AA on its surface).',
    values: states,
  },
];

/** Every colour token by its CSS name without the `--color-` prefix (`ink-muted`, `brand-500`…). */
export const colors = {
  ...brand,
  ...neutral,
  ...surfaces,
  ...actions,
  ...calendar,
  ...accentTint,
  ...crew,
  ...states,
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Deprecated: `blue-*` used to be remapped to the brand green. On the web it stays as a CSS alias
 * (`--color-blue-N: var(--color-brand-N)`) so pages not yet migrated keep their look. Native code
 * never uses it: it exists only so the generator reproduces the alias.
 */
export const deprecatedBlueAlias = {
  of: 'brand',
  steps: brandSteps,
  comment:
    'Deprecated: `blue-*` used to be remapped to the brand green. It stays as an alias so\n   * pages not yet migrated keep their look; new code must use `brand-*` or semantic tokens.',
} as const;

export const fonts = {
  sans: {
    /** Family of the web (`@fontsource-variable/manrope`). */
    web: 'Manrope Variable',
    /** Name to register with `expo-font` on native (variable axes are not shared across platforms). */
    native: 'Manrope',
    fallback: 'system-ui, sans-serif',
  },
  display: {
    web: 'Fraunces Variable',
    native: 'Fraunces',
    fallback: 'Georgia, serif',
  },
} as const;

/** Radii in px (CSS output uses rem, except for the pill). */
export const radii = {
  control: 8,
  card: 14,
  sheet: 16,
  pill: 9999,
} as const;

/** A box shadow as structured data: web builds `box-shadow`, native builds `shadow*` props. */
export interface ShadowToken {
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  /** RGB channels of the shadow colour (0-255). */
  readonly rgb: readonly [number, number, number];
  readonly alpha: number;
}

export const shadows = {
  card: { x: 0, y: 1, blur: 2, spread: 0, rgb: [16, 45, 43], alpha: 0.06 },
  popover: { x: 0, y: 12, blur: 36, spread: 0, rgb: [20, 45, 35], alpha: 0.18 },
  toast: { x: 0, y: 8, blur: 35, spread: 0, rgb: [16, 45, 43], alpha: 0.15 },
  modal: { x: 0, y: 30, blur: 100, spread: 0, rgb: [16, 45, 43], alpha: 0.13 },
} as const satisfies Record<string, ShadowToken>;

/** Breakpoints in px. `shell`: side navigation from 801 px (`shell:` / `max-shell:`). */
export const breakpoints = { shell: 801 } as const;

/**
 * Page titles. Body text uses Tailwind's xs-4xl scale; do not go below 12 px.
 * Web: `clamp(min, vw, max)`; native: use `max` at ≥ tablet widths and `min` on phones.
 */
export const display = {
  min: 28,
  max: 40,
  /** Preferred size in vw (web only). */
  vw: 3.1,
  lineHeight: 1.18,
} as const;

/**
 * Spacing scale in px for native (4 px base, the same one Tailwind uses by default on the web).
 * The web does not emit it into `@theme`: it relies on Tailwind's default spacing.
 */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const tokens = { colors, fonts, radii, shadows, breakpoints, display, spacing } as const;

import { colors, display, nativeShadows, radii, spacing } from '@bg/ui-tokens';

/**
 * Static font families registered with expo-font (app.config.ts). Native does not pick a weight
 * from a variable font reliably, so each weight is its own file (scripts/build-fonts.py).
 */
export const fontFamily = {
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  display: 'Fraunces-Medium',
} as const;

/** Type scale of the web (Tailwind's text-xs…text-2xl) plus the phone size of the page title. */
export const typography = {
  caption: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 16, lineHeight: 24 },
  label: { fontSize: 14, lineHeight: 20 },
  title: { fontSize: 20, lineHeight: 28 },
  display: { fontSize: display.min, lineHeight: Math.round(display.min * display.lineHeight) },
} as const;

/** Minimum touch target, as `--control-height` on the web. */
export const controlHeight = 44;

export const theme = { colors, radii, spacing, shadows: nativeShadows, fontFamily, typography };

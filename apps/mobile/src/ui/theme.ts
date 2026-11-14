import { colors, display, nativeShadows, radii, spacing } from '@bg/ui-tokens';
import { isAndroid, touchTarget } from './platform';

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

/** Minimum touch target (`--control-height` on the web): 44 pt on iOS, 48 dp on Android. */
export const controlHeight = touchTarget;

/**
 * Shapes of the native look (README «Diseño nativo»). iOS 26 uses capsule controls and large
 * continuous corners; Material 3 uses full-round buttons, 4 dp text fields (extra-small), 12 dp
 * cards (medium) and 16 dp groups (large). The web radii (`radii`) stay for web-like elements.
 */
export const shapes = isAndroid
  ? { button: radii.pill, field: 4, card: 12, group: 16 }
  : { button: radii.pill, field: 12, card: 24, group: 24 };

/**
 * Brand colours mapped onto the system roles. Material 3 roles: `secondaryContainer` (tonal
 * button, navigation indicator) is the brand `highlight`, `surfaceContainer` (navigation bar)
 * is the web sidebar colour. iOS: glass tints with the brand primary.
 */
export const systemColors = {
  secondaryContainer: colors.highlight,
  onSecondaryContainer: colors['ink-strong'],
  surfaceContainer: colors.sidebar,
  ripple: 'rgba(36, 86, 76, 0.16)', // primary at 16 %, the M3 pressed state layer.
  rippleOnPrimary: 'rgba(255, 253, 248, 0.24)',
} as const;

export const theme = {
  colors,
  radii,
  spacing,
  shadows: nativeShadows,
  fontFamily,
  typography,
  shapes,
  systemColors,
};

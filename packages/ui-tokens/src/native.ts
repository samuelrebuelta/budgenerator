import type { ShadowToken } from './tokens.ts';
import { shadows } from './tokens.ts';

/** Subset of React Native's shadow style props (iOS `shadow*`, Android `elevation`). */
export interface NativeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

const hex = (n: number) => n.toString(16).padStart(2, '0');

/**
 * Converts a CSS-style shadow token into React Native props. `shadowRadius` is half the CSS blur
 * (CSS blur is the diameter of the gaussian); spread has no native equivalent and is ignored.
 * `elevation` is a rough Android equivalent derived from the vertical offset.
 */
export function toNativeShadow(shadow: ShadowToken): NativeShadow {
  const [r, g, b] = shadow.rgb;
  return {
    shadowColor: `#${hex(r)}${hex(g)}${hex(b)}`,
    shadowOffset: { width: shadow.x, height: shadow.y },
    shadowOpacity: shadow.alpha,
    shadowRadius: shadow.blur / 2,
    elevation: Math.max(1, Math.round(shadow.y / 3)),
  };
}

export const nativeShadows = {
  card: toNativeShadow(shadows.card),
  popover: toNativeShadow(shadows.popover),
  toast: toNativeShadow(shadows.toast),
  modal: toNativeShadow(shadows.modal),
} as const;

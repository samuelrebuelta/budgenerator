import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

/**
 * Native design language of the device (README «Diseño nativo»):
 * - `glass`: iOS 26+ with Liquid Glass and neither Reduce Transparency nor Increase Contrast on.
 * - `ios`: older iOS, or iOS 26 with one of those settings: solid surfaces with the same shapes.
 * - `material`: Android, Material 3 (ripple, tonal surfaces, M3 shapes).
 */
export type NativeLook = 'glass' | 'ios' | 'material';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/**
 * Liquid Glass is a property of the OS build (iOS 26+), so it is read once. System bars use it
 * regardless of the accessibility settings (UIKit adapts them); our own glass uses `useNativeLook`.
 */
export const liquidGlass = isIOS && safeGlassCheck();

function safeGlassCheck() {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** Reduce Transparency / Increase Contrast, shared by every surface (one set of listeners). */
const accessibility = { transparency: false, contrast: false };
const listeners = new Set<() => void>();
let watching = false;

function watchAccessibility() {
  if (watching || !liquidGlass) return;
  watching = true;
  const set = (key: keyof typeof accessibility) => (value: boolean) => {
    if (accessibility[key] === value) return;
    accessibility[key] = value;
    listeners.forEach((listener) => listener());
  };
  void AccessibilityInfo.isReduceTransparencyEnabled().then(set('transparency'));
  void AccessibilityInfo.isDarkerSystemColorsEnabled().then(set('contrast'));
  AccessibilityInfo.addEventListener('reduceTransparencyChanged', set('transparency'));
  AccessibilityInfo.addEventListener('darkerSystemColorsChanged', set('contrast'));
}

function subscribe(listener: () => void) {
  watchAccessibility();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function currentLook(): NativeLook {
  if (isAndroid) return 'material';
  return liquidGlass && !accessibility.transparency && !accessibility.contrast ? 'glass' : 'ios';
}

/**
 * Current look, following the accessibility settings live: with Reduce Transparency or Increase
 * Contrast («Aumentar contraste», `darkerSystemColors`) the app drops its own glass and draws solid
 * surfaces with a visible border. System bars (tabs, headers, sheets) adapt by themselves.
 */
export function useNativeLook(): NativeLook {
  return useSyncExternalStore(subscribe, currentLook, currentLook);
}

/** Minimum touch target: 44 pt (HIG) on iOS, 48 dp (Material) on Android. */
export const touchTarget = isAndroid ? 48 : 44;

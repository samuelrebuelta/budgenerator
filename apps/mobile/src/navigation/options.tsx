import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from 'expo-router';
import { colors } from '@bg/ui-tokens';
import { fontFamily, liquidGlass as glass } from '../ui';
import { AccountMenuButton } from './AccountMenuButton';

/**
 * Native stack header of each platform (README «Diseño nativo»):
 * - iOS 26: no header background, so the system draws its transparent Liquid Glass header with
 *   the scroll edge effect; titles in Manrope and large titles in Fraunces (the web's display).
 * - iOS < 26: opaque header on the brand canvas.
 * - Android: Material 3 small top app bar on the canvas (title start-aligned, 22 sp, no shadow).
 */
const headerBase: NativeStackNavigationOptions = Platform.select({
  ios: {
    headerTintColor: colors.primary,
    headerTitleStyle: { fontFamily: fontFamily.semibold, color: colors['ink-strong'] },
    headerLargeTitleStyle: { fontFamily: fontFamily.display, color: colors['ink-strong'] },
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    ...(glass
      ? {}
      : {
          headerStyle: { backgroundColor: colors.canvas },
          headerLargeStyle: { backgroundColor: colors.canvas },
        }),
    contentStyle: { backgroundColor: colors.canvas },
  },
  default: {
    headerStyle: { backgroundColor: colors.canvas },
    headerShadowVisible: false,
    headerTintColor: colors.ink,
    headerTitleStyle: {
      fontFamily: fontFamily.semibold,
      color: colors['ink-strong'],
      fontSize: 22,
    },
    contentStyle: { backgroundColor: colors.canvas },
  },
});

/**
 * Header of a root tab: iOS large title that collapses into the glass header when scrolling
 * (the screen's root is the `ScrollView`, `Screen edges={[]}`), and the account button.
 */
export const tabRootOptions = (title: string): NativeStackNavigationOptions => ({
  ...headerBase,
  title,
  headerLargeTitleEnabled: true,
  headerRight: () => <AccountMenuButton />,
});

/**
 * Pushed screen of a tab stack (budget detail): standard title that the scroll edge effect of iOS
 * 26 puts on glass, minimal back button (only the chevron), Material 3 top app bar on Android.
 */
export const detailOptions = (title: string): NativeStackNavigationOptions => ({
  ...headerBase,
  title,
  headerBackButtonDisplayMode: 'minimal',
});

/**
 * Editing sheet over a screen (budget item, chapter, guided structure). iOS: `formSheet` with the
 * given detents and the grabber (a Liquid Glass sheet on iOS 26, its content opaque). Android:
 * full-screen modal with the M3 top app bar, as the account menu.
 */
export const sheetOptions = (
  title: string,
  detents: number[] = [1],
): NativeStackNavigationOptions =>
  Platform.select<NativeStackNavigationOptions>({
    ios: {
      ...headerBase,
      title,
      presentation: 'formSheet',
      sheetAllowedDetents: detents,
      sheetGrabberVisible: true,
      sheetInitialDetentIndex: 0,
      headerShown: true,
      contentStyle: { backgroundColor: colors.canvas },
    },
    default: { ...headerBase, title, presentation: 'modal' },
  });

/** Header of the menu sheet's screens; on iOS 26 the sheet's glass shows through. */
export const menuScreenOptions: NativeStackNavigationOptions = {
  ...headerBase,
  headerBackButtonDisplayMode: 'minimal',
  ...(glass ? { contentStyle: { backgroundColor: 'transparent' } } : {}),
};

/** Whether the menu sheet shows the system glass (iOS 26) instead of the canvas. */
export const menuOnGlass = glass;

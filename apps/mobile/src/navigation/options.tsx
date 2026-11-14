import type { NativeStackNavigationOptions } from 'expo-router';
import { colors } from '@bg/ui-tokens';
import { fontFamily } from '../ui';
import { AccountMenuButton } from './AccountMenuButton';

const headerBase: NativeStackNavigationOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.canvas },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fontFamily.semibold, color: colors['ink-strong'] },
  contentStyle: { backgroundColor: colors.canvas },
};

/**
 * Native header of a root tab with the account icon. §6.1 asks for the iOS large title, but with
 * react-native-screens 4.30 on iOS 26 it renders blank (checked on the simulator, even with the
 * scroll view as the root view): standard title until it is fixed upstream (TODO BG-014).
 */
export const tabRootOptions = (title: string): NativeStackNavigationOptions => ({
  ...headerBase,
  title,
  headerRight: () => <AccountMenuButton />,
});

/** Header of the menu modal's screens. */
export const menuScreenOptions: NativeStackNavigationOptions = {
  ...headerBase,
  headerBackButtonDisplayMode: 'minimal',
};

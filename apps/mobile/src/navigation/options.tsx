import { Platform } from 'react-native';
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

/** Native header of a root tab: large title on iOS (§6.1) and the account icon. */
export const tabRootOptions = (title: string): NativeStackNavigationOptions => ({
  ...headerBase,
  title,
  headerLargeTitle: Platform.OS === 'ios',
  headerLargeTitleShadowVisible: false,
  headerLargeTitleStyle: { fontFamily: fontFamily.display, color: colors['ink-strong'] },
  headerRight: () => <AccountMenuButton />,
});

/** Header of the menu modal's screens. */
export const menuScreenOptions: NativeStackNavigationOptions = {
  ...headerBase,
  headerBackButtonDisplayMode: 'minimal',
};

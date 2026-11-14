import { NativeTabs } from 'expo-router/native-tabs';
import { colors } from '@bg/ui-tokens';
import { saveLastTab } from '../../../src/navigation/lastTab';
import { TAB_SCREENS } from '../../../src/navigation/tabs';
import { useSession } from '../../../src/session';
import { fontFamily, systemColors } from '../../../src/ui';

/**
 * Root tabs in the web's order with the system tab bar (`NativeTabs`): on iOS 26 the floating
 * Liquid Glass bar, which minimises while scrolling down; on Android the Material 3 navigation
 * bar with its active indicator. Every focus is remembered for the next launch (D8).
 */
export default function TabsLayout() {
  const { uid } = useSession();
  return (
    <NativeTabs
      tintColor={colors.primary}
      iconColor={{ default: colors['ink-muted'], selected: colors.primary }}
      labelStyle={{
        default: { fontFamily: fontFamily.medium, color: colors['ink-muted'] },
        selected: { fontFamily: fontFamily.semibold, color: colors['ink-strong'] },
      }}
      minimizeBehavior="onScrollDown"
      // Android (Material 3): navigation bar on the web sidebar colour, brand indicator and ripple.
      backgroundColor={systemColors.surfaceContainer}
      indicatorColor={systemColors.secondaryContainer}
      rippleColor={systemColors.ripple}
      labelVisibilityMode="labeled"
      screenListeners={({ route }) => ({ focus: () => saveLastTab(uid, route.name) })}
    >
      {TAB_SCREENS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name} testID={`tab-${tab.name}`}>
          <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

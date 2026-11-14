import { Tabs } from 'expo-router';
import { colors } from '@bg/ui-tokens';
import { TAB_SCREENS } from '../../../src/navigation/tabs';
import { fontFamily } from '../../../src/ui';

// TODO(BG-014): tab icons. The web uses lucide; pick lucide-react-native (needs
// react-native-svg) or SF Symbols/Material via expo-symbols in phase 1.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors['ink-muted'],
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 12 },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
      }}
    >
      {TAB_SCREENS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </Tabs>
  );
}

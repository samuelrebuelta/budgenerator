import { Tabs } from 'expo-router';
import { colors } from '@bg/ui-tokens';
import { saveLastTab } from '../../../src/navigation/lastTab';
import { TAB_SCREENS } from '../../../src/navigation/tabs';
import { useSession } from '../../../src/session';
import { fontFamily, Icon } from '../../../src/ui';

/** Root tabs in the web's order; every focus is remembered for the next launch (D8). */
export default function TabsLayout() {
  const { uid } = useSession();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors['ink-muted'],
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 12 },
      }}
      screenListeners={({ route }) => ({ focus: () => saveLastTab(uid, route.name) })}
    >
      {TAB_SCREENS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Icon name={tab.icon} color={String(color)} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

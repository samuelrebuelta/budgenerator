import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { Screen, Text } from '../../../src/ui';
import { MENU_SECTIONS } from '../../../src/navigation/menu';

/** Placeholder of the menu entries that arrive in phase 2 (BG-014, «Paridad»). */
export default function MenuSectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const entry = MENU_SECTIONS.find((item) => item.id === section && item.id !== 'account');
  if (!entry) return <Redirect href="/menu" />;
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: entry.title }} />
      <Text tone="muted" testID="menu-placeholder">
        {entry.title} llegará a la app en una próxima versión. Mientras tanto, está disponible en la
        web.
      </Text>
    </Screen>
  );
}

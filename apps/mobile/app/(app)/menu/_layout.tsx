import { router, Stack } from 'expo-router';
import { HeaderIconButton } from '../../../src/navigation/HeaderIconButton';
import { menuScreenOptions } from '../../../src/navigation/options';

/** Account menu (§4.2): a native sheet with a list, not a drawer. */
export default function MenuLayout() {
  return (
    <Stack screenOptions={menuScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Menú',
          headerRight: () => (
            <HeaderIconButton icon="x" label="Cerrar" onPress={() => router.dismissTo('/')} />
          ),
        }}
      />
      <Stack.Screen name="account" options={{ title: 'Mi cuenta' }} />
      <Stack.Screen name="[section]" options={{ title: '' }} />
    </Stack>
  );
}

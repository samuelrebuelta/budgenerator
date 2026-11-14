import { router, Stack } from 'expo-router';
import { menuScreenOptions } from '../../../src/navigation/options';
import { Button } from '../../../src/ui';

/** Account menu (§4.2): a modal with a list, not a drawer. */
export default function MenuLayout() {
  return (
    <Stack screenOptions={menuScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Menú',
          headerRight: () => (
            <Button label="Cerrar" variant="link" onPress={() => router.dismissTo('/')} />
          ),
        }}
      />
      <Stack.Screen name="account" options={{ title: 'Mi cuenta' }} />
      <Stack.Screen name="[section]" options={{ title: '' }} />
    </Stack>
  );
}

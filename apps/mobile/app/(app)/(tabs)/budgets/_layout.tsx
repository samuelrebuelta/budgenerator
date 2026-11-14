import { Stack } from 'expo-router';
import { tabRootOptions } from '../../../../src/navigation/options';

export default function PresupuestosLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={tabRootOptions('Presupuestos')} />
    </Stack>
  );
}

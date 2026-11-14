import { Stack } from 'expo-router';
import { tabRootOptions } from '../../../../src/navigation/options';

export default function EquipoLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={tabRootOptions('Equipo')} />
    </Stack>
  );
}

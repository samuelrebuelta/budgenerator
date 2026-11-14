import { Stack } from 'expo-router';
import { tabRootOptions } from '../../../../src/navigation/options';

export default function ProyectosLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={tabRootOptions('Proyectos')} />
    </Stack>
  );
}

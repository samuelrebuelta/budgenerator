import { Stack } from 'expo-router';
import { detailOptions, sheetOptions, tabRootOptions } from '../../../../src/navigation/options';

/**
 * Projects stack: list → detail, with the progress history, «Nueva ampliación» and «Anular
 * ampliación» as native sheets over the detail (formSheet on iOS, modal on Android).
 */
export default function ProyectosLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={tabRootOptions('Proyectos')} />
      <Stack.Screen name="[projectId]/index" options={detailOptions('Proyecto')} />
      <Stack.Screen
        name="[projectId]/history"
        options={sheetOptions('Evolución del proyecto', [0.75, 1])}
      />
      <Stack.Screen name="[projectId]/supplement" options={sheetOptions('Nueva ampliación', [1])} />
      <Stack.Screen name="[projectId]/void" options={sheetOptions('Anular ampliación', [0.6, 1])} />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { detailOptions, sheetOptions, tabRootOptions } from '../../../../src/navigation/options';

/**
 * Budgets stack: list → detail/editor (`new` is the unsaved draft, as `/budget/new` on the web) and
 * the editor's sheets (item, chapter, guided structure) as native sheets over the editor.
 */
export default function PresupuestosLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={tabRootOptions('Presupuestos')} />
      <Stack.Screen name="[budgetId]/index" options={detailOptions('Presupuesto')} />
      <Stack.Screen name="[budgetId]/item" options={sheetOptions('Partida', [0.75, 1])} />
      <Stack.Screen name="[budgetId]/chapter" options={sheetOptions('Capítulo', [0.6, 1])} />
      <Stack.Screen name="[budgetId]/structure" options={sheetOptions('Crear paso a paso', [1])} />
    </Stack>
  );
}

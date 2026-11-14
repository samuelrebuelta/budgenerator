import { Screen, Text } from '../../../../src/ui';

export default function BudgetsScreen() {
  return (
    <Screen title="Presupuestos" edges={['top']}>
      <Text tone="muted">La lista de presupuestos llegará en la fase 1.</Text>
    </Screen>
  );
}

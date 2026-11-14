import { Screen, Text } from '../../../../src/ui';

export default function LeadsScreen() {
  return (
    <Screen edges={[]}>
      <Text tone="muted" testID="leads-placeholder">
        Las solicitudes de presupuesto llegarán en la siguiente entrega de la fase 1.
      </Text>
    </Screen>
  );
}

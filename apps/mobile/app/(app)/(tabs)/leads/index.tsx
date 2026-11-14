import { Screen, Text } from '../../../../src/ui';

export default function LeadsScreen() {
  return (
    <Screen title="Solicitudes" edges={['top']}>
      <Text tone="muted">Las solicitudes de presupuesto llegarán en la fase 1.</Text>
    </Screen>
  );
}

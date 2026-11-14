import { Screen, Text } from '../../../../src/ui';

export default function TeamScreen() {
  return (
    <Screen edges={[]}>
      <Text tone="muted" testID="team-placeholder">
        La planificación del equipo llegará en la fase 2.
      </Text>
    </Screen>
  );
}

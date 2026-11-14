import { Link } from 'expo-router';
import { Screen, Text } from '../src/ui';

export default function NotFoundScreen() {
  return (
    <Screen title="No encontrado">
      <Text tone="muted">Esta pantalla no existe.</Text>
      <Link href="/">
        <Text tone="strong" weight="semibold">
          Volver al inicio
        </Text>
      </Link>
    </Screen>
  );
}

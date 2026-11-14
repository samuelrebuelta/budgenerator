import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { spacing } from '@bg/ui-tokens';
import { runtimeSelfCheck } from '../../src/platform/runtime';
import { appVariant } from '../../src/platform/variant';
import { Button, Card, Screen, Text } from '../../src/ui';

/** Login placeholder (phase 0). Email/password with RNFB Auth arrives in phase 1. */
export default function LoginScreen() {
  return (
    <Screen title="BudGenerator">
      <Text tone="muted">Presupuestos y obras de tu empresa, también sin conexión.</Text>
      <Card style={styles.card}>
        <Text variant="title">Inicia sesión</Text>
        <Text tone="muted">El acceso con email y contraseña llegará en la fase 1.</Text>
        <Button label="Entrar" disabled fullWidth />
      </Card>
      {appVariant === 'development' ? <RuntimeDiagnostics /> : null}
    </Screen>
  );
}

/** Development only: proves that `@bg/domain` and the web globals work on this engine. */
function RuntimeDiagnostics() {
  const checks = useMemo(() => runtimeSelfCheck(), []);
  return (
    <Card style={styles.card} testID="runtime-diagnostics">
      <Text variant="label" weight="semibold">
        Variante {appVariant} · motor {'HermesInternal' in globalThis ? 'Hermes' : 'JS'}
      </Text>
      {checks.map((item) => (
        <Text key={item.name} variant="caption" tone={item.ok ? 'muted' : 'danger'}>
          {item.ok ? '✓' : '✗'} {item.name}: {item.detail}
        </Text>
      ))}
      <Button
        label="Spikes de fase 0"
        variant="secondary"
        onPress={() => router.push('/dev/spikes')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
});

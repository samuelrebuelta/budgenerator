import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@bg/ui-tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface LoadingScreenProps {
  /** Message shown instead of the spinner, with a retry button when `onRetry` is given. */
  error?: string | null;
  onRetry?: () => void;
  /** Status text without a spinner (the web's «Abriendo la última copia guardada…»). */
  message?: string;
}

/** Equivalent of the web's `LoadingScreen` and offline restore status of `AuthGuard`. */
export function LoadingScreen({ error, onRetry, message }: LoadingScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content} accessibilityLiveRegion="polite">
        {error ? (
          <>
            <Text tone="danger" style={styles.center} accessibilityRole="alert">
              {error}
            </Text>
            {onRetry ? <Button label="Reintentar" variant="secondary" onPress={onRetry} /> : null}
          </>
        ) : message ? (
          <Text tone="muted" variant="label" style={styles.center}>
            {message}
          </Text>
        ) : (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando" />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[4],
  },
  center: { textAlign: 'center' },
});

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@bg/ui-tokens';
import { LegalLinks } from '../legal/LegalLinks';
import { Card, Text } from '../../ui';

/** Frame of the auth screens: brand word, page title, form card and the legal links. */
export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={spacing[6]}
      >
        <View style={styles.brand} accessible accessibilityLabel="budgenerator">
          <Text variant="title" weight="bold" tone="strong">
            budgenerator<Text style={styles.dot}>.</Text>
          </Text>
        </View>
        <Text variant="display" tone="strong">
          {title}
        </Text>
        <Card style={styles.card}>{children}</Card>
        <LegalLinks />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing[6], gap: spacing[5] },
  brand: { flexDirection: 'row' },
  dot: { color: colors.accent },
  card: { gap: spacing[4] },
});

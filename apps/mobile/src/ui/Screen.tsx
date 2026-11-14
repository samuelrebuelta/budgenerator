import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@bg/ui-tokens';
import { Text } from './Text';

export interface ScreenProps {
  title?: string;
  children?: ReactNode;
  /** Scrollable content (default) or a fixed view for screens with their own list. */
  scroll?: boolean;
  /**
   * Safe-area edges to pad; screens under a native header or tab bar only need some (`[]` under
   * a native stack header, which also insets the scroll view automatically on iOS).
   */
  edges?: Edge[];
}

/** Base of every screen: canvas background, safe area and an optional page title. */
export function Screen({ title, children, scroll = true, edges = ['top', 'bottom'] }: ScreenProps) {
  const body = (
    <>
      {title ? (
        <Text variant="display" tone="strong" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {children}
    </>
  );
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{body}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4] },
  fill: { flex: 1 },
  title: { marginBottom: spacing[1] },
});

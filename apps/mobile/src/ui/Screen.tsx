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
  /** No canvas: the container's material shows through (the iOS 26 glass sheet of the menu). */
  transparent?: boolean;
}

/** Base of every screen: canvas background, safe area and an optional page title. */
export function Screen({
  title,
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  transparent = false,
}: ScreenProps) {
  const background = [styles.safeArea, transparent && styles.transparent];
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
  // Under a native stack header the scroll view has to be the screen's root view: iOS only
  // attaches the large title (and insets the content) to a root scroll view.
  if (scroll && edges.length === 0)
    return (
      <ScrollView
        style={background}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>
    );
  return (
    <SafeAreaView style={background} edges={edges}>
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
  transparent: { backgroundColor: 'transparent' },
  fill: { flex: 1 },
  title: { marginBottom: spacing[1] },
});

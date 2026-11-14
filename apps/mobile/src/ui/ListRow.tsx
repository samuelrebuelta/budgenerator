import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@bg/ui-tokens';
import { Text } from './Text';
import { controlHeight } from './theme';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Right-hand content: an amount, a badge or a chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
}

/** Row of a list; pressable when it has `onPress`. */
export function ListRow({ title, subtitle, trailing, onPress }: ListRowProps) {
  const content = (
    <>
      <View style={styles.texts}>
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" tone="muted" weight="regular" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: controlHeight + spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors['surface-muted'] },
  texts: { flex: 1, gap: spacing[0.5] },
});

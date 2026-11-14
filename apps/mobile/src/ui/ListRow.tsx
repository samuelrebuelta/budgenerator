import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@bg/ui-tokens';
import { Icon, type IconName } from './Icon';
import { isAndroid, isIOS } from './platform';
import { Text } from './Text';
import { controlHeight, shapes, systemColors } from './theme';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading icon (SF Symbol / Material Symbol through `Icon`). */
  icon?: IconName;
  /** Right-hand content: an amount or a badge. Pressable rows add the iOS chevron by themselves. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  /** Set by `ListGroup`: separator above the row. */
  divider?: boolean;
}

/**
 * Row of a list; pressable when it has `onPress`. iOS: highlight on press and disclosure chevron.
 * Android: Material 3 list item (56 dp, ripple, no chevron).
 */
export function ListRow({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  accessibilityLabel,
  testID,
  divider = false,
}: ListRowProps) {
  const content = (
    <>
      {icon ? <Icon name={icon} size={22} color={colors.primary} /> : null}
      <View style={[styles.texts, divider && styles.divider]}>
        <View style={styles.textColumn}>
          <Text variant="body" weight="medium" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="label" tone="muted" weight="regular" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing}
        {onPress && isIOS ? (
          <Icon name="chevron-right" size={14} color={colors['ink-subtle']} />
        ) : null}
      </View>
    </>
  );
  if (!onPress)
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
      onPress={onPress}
      android_ripple={{ color: systemColors.ripple }}
      style={({ pressed }) => [styles.row, pressed && isIOS && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** Group of rows: iOS inset-grouped block, Material 3 list on a rounded surface. */
export function ListGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<ListRowProps>[];
  return (
    <View style={styles.group}>
      {rows.map((row, index) => cloneElement(row, { divider: index > 0 }))}
    </View>
  );
}

const rowHeight = isAndroid ? 56 : controlHeight + spacing[2];

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: shapes.group,
    borderCurve: 'continuous',
    overflow: 'hidden',
    ...(isIOS ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line } : {}),
  },
  row: {
    minHeight: rowHeight,
    paddingLeft: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: isAndroid ? spacing[4] : spacing[3],
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors['surface-muted'] },
  // On iOS the separator starts at the text, like UITableView's inset separators.
  texts: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingRight: spacing[4],
  },
  divider: isIOS ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line } : {},
  textColumn: { flex: 1, gap: spacing[0.5] },
});

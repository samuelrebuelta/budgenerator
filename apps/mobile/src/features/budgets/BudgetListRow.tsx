import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { formatEuros } from '@bg/domain';
import { colors, spacing } from '@bg/ui-tokens';
import { Icon, isAndroid, isIOS, systemColors, Text } from '../../ui';
import { formatBudgetDate, type BudgetListEntry } from './model';

export interface BudgetListRowProps {
  entry: BudgetListEntry;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Trailing swipe action (iOS Mail style, also on Android): only for editable budgets. */
function DeleteAction({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Eliminar ${label}`}
      onPress={onPress}
      style={styles.deleteAction}
      testID="budget-row-delete"
    >
      <Icon name="trash-2" size={20} color={colors['on-primary']} />
      <Text variant="caption" weight="semibold" tone="onPrimary">
        Eliminar
      </Text>
    </Pressable>
  );
}

/**
 * Row of the budgets list (web `BudgetsPage`): number, client, address or chapters, status, date
 * and total with VAT. Accepted budgets and those converted into a project cannot be deleted, so
 * they have no swipe action (the web disables the swipe too). VoiceOver/TalkBack reach the delete
 * action through the row's custom actions.
 */
export const BudgetListRow = memo(function BudgetListRow({
  entry,
  onOpen,
  onDelete,
}: BudgetListRowProps) {
  const { record, view, total } = entry;
  const name = view.info.clientName || 'Proyecto sin nombre';
  const status = record.projectId
    ? 'Proyecto en seguimiento'
    : record.acceptedAt
      ? 'Presupuesto aceptado'
      : null;
  const deletable = !record.projectId && !record.acceptedAt;
  const date = formatBudgetDate(view.info.date);
  const amount = formatEuros(total);
  const row = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${amount}, ${date}${status ? `, ${status}` : ''}`}
      accessibilityActions={deletable ? [{ name: 'delete', label: 'Eliminar' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') onDelete(record.id);
      }}
      onPress={() => onOpen(record.id)}
      android_ripple={{ color: systemColors.ripple }}
      style={({ pressed }) => [styles.row, pressed && isIOS && styles.pressed]}
      testID={`budget-row-${record.id}`}
    >
      <View style={styles.number}>
        <Text variant="caption" weight="semibold" tone="muted" numberOfLines={1}>
          {view.info.budgetNumber || '—'}
        </Text>
      </View>
      <View style={styles.texts}>
        <Text weight="semibold" tone="strong" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="label" tone="muted" weight="regular" numberOfLines={1}>
          {view.info.address || `${view.workItems.length} capítulos`}
        </Text>
        {status ? (
          <Text variant="caption" weight="medium" style={styles.status}>
            {status}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <Text weight="semibold" tone="strong" style={styles.amount}>
          {amount}
        </Text>
        <Text variant="caption" tone="muted">
          {date}
        </Text>
      </View>
      {isIOS ? <Icon name="chevron-right" size={14} color={colors['ink-subtle']} /> : null}
    </Pressable>
  );
  if (!deletable) return row;
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => <DeleteAction label={name} onPress={() => onDelete(record.id)} />}
    >
      {row}
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: isAndroid ? 88 : 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors['surface-muted'] },
  number: {
    minWidth: 40,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[1],
    borderRadius: 8,
    backgroundColor: colors['surface-muted'],
    alignItems: 'center',
  },
  texts: { flex: 1, gap: 2 },
  status: { color: colors['ink-strong'] },
  trailing: { alignItems: 'flex-end', gap: 2 },
  amount: { fontVariant: ['tabular-nums'] },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    backgroundColor: colors['danger-solid'],
  },
});

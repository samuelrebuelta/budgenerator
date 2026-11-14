import { StyleSheet, View } from 'react-native';
import { t } from '@bg/domain/i18n';
import { FREE_BUDGET_LIMIT, getBudgetSlotsUsed } from '@bg/domain/lib/utils';
import { colors, spacing } from '@bg/ui-tokens';
import { Icon, Text } from '../../ui';

/**
 * Equivalent of the web's `BudgetLimitReached` without the call to get Premium (D7: no prices,
 * purchases or payment links while BG-004 is deferred): title, the plan message and the slots used.
 */
export function BudgetLimitReached({ totalBudgetsCreated }: { totalBudgetsCreated: number }) {
  return (
    <View style={styles.box} accessibilityRole="summary" testID="budget-limit-reached">
      <Icon name="lock" size={36} color={colors['warning-ink']} />
      <Text variant="title" tone="strong" style={styles.center}>
        {t('budgets.limitReachedTitle')}
      </Text>
      <Text tone="muted" style={styles.center}>
        Has alcanzado el límite de tu plan.
      </Text>
      <Text variant="label" tone="muted" weight="regular" style={styles.center}>
        {t('budgets.budgetsUsed', {
          used: getBudgetSlotsUsed(totalBudgetsCreated),
          limit: FREE_BUDGET_LIMIT,
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] },
  center: { textAlign: 'center' },
});

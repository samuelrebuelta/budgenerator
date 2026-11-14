import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatCents, formatDateTime } from '@bg/domain';
import type { QuoteLead } from '@bg/domain/quote-estimator/types';
import { colors, spacing } from '@bg/ui-tokens';
import { Icon, isAndroid, isIOS, systemColors, Text } from '../../ui';
import { selectionSummary } from './model';

/** «Presupuesto creado» / «Sin presupuesto», the only state a lead has (web: the button shown). */
export function LeadBudgetBadge({ budgeted }: { budgeted: boolean }) {
  const label = budgeted ? 'Presupuesto creado' : 'Sin presupuesto';
  return (
    <View
      style={[styles.badge, budgeted ? styles.badgeDone : styles.badgePending]}
      accessible
      accessibilityLabel={`Estado: ${label}`}
    >
      <Text
        variant="caption"
        weight="semibold"
        style={{ color: budgeted ? colors['success-ink'] : colors['info-ink'] }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Row of the leads list (web `LeadsPage` card, condensed): client, date, requested work, the
 * orientative range and whether a budget was already created from it.
 */
export const LeadListRow = memo(function LeadListRow({
  lead,
  onOpen,
}: {
  lead: QuoteLead;
  onOpen: (id: string) => void;
}) {
  const lines = selectionSummary(lead);
  const work = lines.length > 1 ? `${lines[0]} y ${lines.length - 1} más` : (lines[0] ?? '');
  const range = `${formatCents(lead.estimate.minimumCents)} – ${formatCents(lead.estimate.maximumCents)}`;
  const date = formatDateTime(lead.createdAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${lead.contact.name}, ${date}, ${work}, horquilla ${range} sin IVA, ${lead.budgetId ? 'presupuesto creado' : 'sin presupuesto'}`}
      onPress={() => onOpen(lead.id)}
      android_ripple={{ color: systemColors.ripple }}
      style={({ pressed }) => [styles.row, pressed && isIOS && styles.pressed]}
      testID={`lead-row-${lead.id}`}
    >
      <View style={styles.top}>
        <View style={styles.texts}>
          <Text weight="semibold" tone="strong" numberOfLines={1}>
            {lead.contact.name}
          </Text>
          <Text variant="label" tone="muted" weight="regular" numberOfLines={2}>
            {work}
          </Text>
        </View>
        {isIOS ? <Icon name="chevron-right" size={14} color={colors['ink-subtle']} /> : null}
      </View>
      <View style={styles.bottom}>
        <LeadBudgetBadge budgeted={Boolean(lead.budgetId)} />
        <Text variant="caption" tone="muted" style={styles.meta} numberOfLines={2}>
          {`${date} · ${range} sin IVA`}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    gap: spacing[2.5],
    paddingHorizontal: spacing[4],
    paddingVertical: isAndroid ? spacing[4] : spacing[3.5],
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors['surface-muted'] },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  texts: { flex: 1, gap: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  meta: { flex: 1 },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeDone: { backgroundColor: colors['success-surface'], borderColor: colors['success-line'] },
  badgePending: { backgroundColor: colors['info-surface'], borderColor: colors['info-line'] },
});

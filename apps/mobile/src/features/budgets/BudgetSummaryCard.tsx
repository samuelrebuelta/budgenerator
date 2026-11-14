import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { decimal, formatEuros } from '@bg/domain';
import type { BudgetRecord } from '@bg/domain/budget/record';
import { t } from '@bg/domain/i18n';
import { colors, spacing } from '@bg/ui-tokens';
import { useBudgetStore } from '../../state/stores';
import { Button, Card, Text, TextField } from '../../ui';
import { runEdit } from './editing';
import { recordTotals } from './model';

function Row({
  label,
  value,
  tone,
  strong = false,
  testID,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label} ${value}`}>
      <Text variant={strong ? 'body' : 'label'} weight={strong ? 'bold' : 'regular'} tone="muted">
        {label}
      </Text>
      <Text
        variant={strong ? 'title' : 'label'}
        weight={strong ? 'bold' : 'medium'}
        style={[styles.amount, tone ? { color: tone } : null, strong && styles.total]}
        testID={testID}
      >
        {value}
      </Text>
    </View>
  );
}

type Adjusting = 'descuento' | 'recargo' | null;

/**
 * Totals of the web's `BudgetSummary`: `budgetTotals` of `@bg/domain` over the canonical document
 * (`recordTotals`), VAT rate, discount (lowers the subtotal) or surcharge (folded into the item
 * prices) and the internal margin. Nothing is computed here.
 */
export function BudgetSummaryCard({
  record,
  isDraft,
  readOnly,
}: {
  record: BudgetRecord;
  isDraft: boolean;
  readOnly: boolean;
}) {
  const updateAdjustment = useBudgetStore((state) => state.updateAdjustment);
  const updateIvaRate = useBudgetStore((state) => state.updateIvaRate);
  const [adjusting, setAdjusting] = useState<Adjusting>(null);
  const [percent, setPercent] = useState('');
  const [reason, setReason] = useState('');
  const totals = recordTotals(record);
  const business = record.document.business;
  const adjustment = business.adjustment;
  const hasAdjustment = !!adjustment && adjustment.multiplier !== 1;
  const isSurcharge = hasAdjustment && adjustment.multiplier > 1;
  const isDiscount = hasAdjustment && adjustment.multiplier < 1;
  const adjustmentPercent = adjustment ? Math.round((adjustment.multiplier - 1) * 100) : 0;
  const ivaPercent = Math.round((business.ivaRate ?? 0.1) * 100);
  const reasonText = adjustment?.reason ? ` (${adjustment.reason})` : '';
  const pct = decimal(percent);
  const maxPercent = adjusting === 'descuento' ? 100 : 1000;
  const canApply = pct > 0 && pct <= maxPercent;

  const apply = () => {
    if (!canApply || !adjusting) return;
    const multiplier = adjusting === 'descuento' ? 1 - pct / 100 : 1 + pct / 100;
    runEdit(isDraft, () => updateAdjustment({ multiplier, reason }));
    setAdjusting(null);
  };

  return (
    <Card style={styles.card} testID="budget-summary">
      {isSurcharge ? (
        <>
          <Row label={t('summary.rawSubtotal')} value={formatEuros(totals.raw)} />
          <Row
            label={`${t('summary.surcharge')}${reasonText} +${adjustmentPercent} %`}
            value={`+${formatEuros(totals.subtotal - totals.raw)}`}
            tone={colors['danger-ink']}
          />
          <Text variant="caption" tone="muted">
            {t('summary.surchargeInTasks', { pct: adjustmentPercent })}
          </Text>
        </>
      ) : null}
      {isDiscount ? (
        <>
          <Row label={t('summary.subtotal')} value={formatEuros(totals.raw)} />
          <Row
            label={`${t('summary.discount')}${reasonText} ${adjustmentPercent} %`}
            value={formatEuros(totals.subtotal - totals.raw)}
            tone={colors['success-ink']}
          />
        </>
      ) : null}
      <Row
        label={isDiscount ? t('summary.adjustedSubtotal') : t('summary.subtotal')}
        value={formatEuros(totals.subtotal)}
        testID="budget-subtotal"
      />
      <View style={styles.row}>
        <View style={styles.iva}>
          <Text variant="label" tone="muted" weight="regular">
            IVA
          </Text>
          <View style={styles.ivaField}>
            <TextField
              label="IVA, porcentaje"
              hideLabel
              value={String(ivaPercent)}
              keyboardType="number-pad"
              editable={!readOnly}
              maxLength={3}
              onChangeText={(value) => {
                const next = Math.max(0, Math.min(100, Number(value.replace(/\D/g, '')) || 0));
                if (next !== ivaPercent) runEdit(isDraft, () => updateIvaRate(next / 100));
              }}
              testID="budget-iva-rate"
            />
          </View>
          <Text variant="label" tone="muted" weight="regular">
            %
          </Text>
        </View>
        <Text variant="label" weight="medium" style={styles.amount} testID="budget-iva">
          {formatEuros(totals.iva)}
        </Text>
      </View>
      <View style={styles.divider} />
      <Row
        label={t('summary.total')}
        value={formatEuros(totals.total)}
        tone={colors.primary}
        strong
        testID="budget-total"
      />

      {!readOnly && !hasAdjustment && !adjusting ? (
        <View style={styles.actions}>
          <Button
            label={t('summary.addDiscount')}
            variant="ghost"
            icon="minus"
            onPress={() => {
              setPercent('');
              setReason('');
              setAdjusting('descuento');
            }}
          />
          <Button
            label={t('summary.addSurcharge')}
            variant="ghost"
            icon="plus"
            onPress={() => {
              setPercent('');
              setReason('');
              setAdjusting('recargo');
            }}
          />
        </View>
      ) : null}
      {!readOnly && hasAdjustment && !adjusting ? (
        <Button
          label={adjustmentPercent < 0 ? t('summary.removeDiscount') : t('summary.removeSurcharge')}
          variant="ghost"
          icon="x"
          onPress={() => runEdit(isDraft, () => updateAdjustment(undefined))}
        />
      ) : null}
      {adjusting ? (
        <View style={styles.adjusting}>
          <Text variant="label" weight="semibold">
            {adjusting === 'descuento' ? t('summary.newDiscount') : t('summary.newSurcharge')}
          </Text>
          <TextField
            label={t('summary.percentage')}
            value={percent}
            keyboardType="decimal-pad"
            placeholder={adjusting === 'descuento' ? 'Ej. 10' : 'Ej. 15'}
            onChangeText={setPercent}
          />
          <TextField
            label={t('summary.reason')}
            value={reason}
            placeholder={t('summary.reasonPlaceholder')}
            autoCapitalize="sentences"
            onChangeText={setReason}
          />
          <View style={styles.actions}>
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setAdjusting(null)} />
            <Button
              label={
                adjusting === 'descuento' ? t('summary.applyDiscount') : t('summary.applySurcharge')
              }
              disabled={!canApply}
              onPress={apply}
            />
          </View>
        </View>
      ) : null}

      {totals.cost > 0 ? (
        <>
          <View style={styles.divider} />
          <Row
            label={t('summary.profitMargin')}
            value={`${formatEuros(totals.margin)} (${(totals.marginRatio * 100).toFixed(1).replace('.', ',')} %)`}
            tone={totals.margin >= 0 ? colors['success-ink'] : colors['danger-ink']}
          />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  amount: { fontVariant: ['tabular-nums'], color: colors['ink-strong'] },
  total: { color: colors.primary },
  iva: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ivaField: { width: 72 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors['line-strong'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'flex-end' },
  adjusting: {
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: 12,
    backgroundColor: colors['surface-muted'],
  },
});

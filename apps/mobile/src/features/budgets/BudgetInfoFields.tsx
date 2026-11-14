import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { t } from '@bg/domain/i18n';
import type { BudgetInfo } from '@bg/domain/types';
import { spacing } from '@bg/ui-tokens';
import { useBudgetStore } from '../../state/stores';
import { Card, Text, TextField } from '../../ui';
import { runEdit } from './editing';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date as `AAAA-MM-DD` (the web's `<input type="date">` value). It is committed only when complete
 * and valid, so the document never keeps a half-typed date. A native date picker needs a new
 * native module and is left for a later delivery (registro BG-014, paso 8).
 */
function DateField({
  value,
  editable,
  onCommit,
}: {
  value: string;
  editable: boolean;
  onCommit: (date: string) => void;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(value);
  }
  const valid = (date: string) => !date || (DATE_PATTERN.test(date) && !isNaN(Date.parse(date)));
  return (
    <TextField
      label={t('header.date')}
      value={text}
      placeholder="AAAA-MM-DD"
      keyboardType="numbers-and-punctuation"
      editable={editable}
      maxLength={10}
      onChangeText={(next) => {
        setText(next);
        if (valid(next) && next !== value) onCommit(next);
      }}
      onBlur={() => {
        if (!valid(text)) setText(value);
      }}
    />
  );
}

/** «Información del cliente» of the web's `BudgetHeader`, with the same labels and placeholders. */
export function BudgetInfoFields({
  info,
  isDraft,
  readOnly,
}: {
  info: BudgetInfo;
  isDraft: boolean;
  readOnly: boolean;
}) {
  const updateInfo = useBudgetStore((state) => state.updateInfo);
  const edit = (patch: Partial<BudgetInfo>) => runEdit(isDraft, () => updateInfo(patch));
  const editable = !readOnly;
  return (
    <Card style={styles.card}>
      <Text variant="label" weight="semibold" tone="muted" style={styles.heading}>
        {t('header.clientInfo').toLocaleUpperCase('es')}
      </Text>
      <TextField
        label={t('header.clientName')}
        value={info.clientName}
        placeholder={t('header.clientNamePlaceholder')}
        autoCapitalize="words"
        editable={editable}
        onChangeText={(clientName) => edit({ clientName })}
        testID="budget-client-name"
      />
      <TextField
        label={t('header.address')}
        value={info.address}
        placeholder={t('header.addressPlaceholder')}
        autoCapitalize="sentences"
        editable={editable}
        onChangeText={(address) => edit({ address })}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <DateField value={info.date} editable={editable} onCommit={(date) => edit({ date })} />
        </View>
        <View style={styles.half}>
          <TextField
            label={t('header.budgetNumber')}
            value={info.budgetNumber}
            placeholder={t('header.budgetNumberPlaceholder')}
            editable={editable}
            onChangeText={(budgetNumber) => edit({ budgetNumber })}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  heading: { letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: spacing[3] },
  half: { flex: 1 },
});

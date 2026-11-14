import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { decimal, formatEuros, generateId } from '@bg/domain';
import { buildProjectSupplement } from '@bg/domain/project/supplements';
import { colors, spacing } from '@bg/ui-tokens';
import { UnitPicker } from '../../../../../src/features/budgets/UnitPicker';
import { useProjectMutation } from '../../../../../src/features/projects/mutations';
import { useProjectStore } from '../../../../../src/state/stores';
import { Button, Card, Notice, Text, TextField } from '../../../../../src/ui';

/**
 * «Nueva ampliación» (web supplement form) as a native sheet: description, quantity, unit and unit
 * price without VAT. The preview uses `buildProjectSupplement` of `@bg/domain`, the same function
 * the transaction uses, so the amounts shown are the ones that will be stored. The request ID is
 * kept across retries so a repeated save does not duplicate it (as on the web).
 */
export default function SupplementSheet() {
  const { projectId = '' } = useLocalSearchParams<{ projectId: string }>();
  const project = useProjectStore((state) =>
    state.activeProject?.id === projectId ? state.activeProject : null,
  );
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('ud');
  const [unitPrice, setUnitPrice] = useState('');
  const [requestId] = useState(() => generateId());
  const { busy, error, run } = useProjectMutation();
  const input = { description, quantity: decimal(quantity), unit, unitPrice: decimal(unitPrice) };
  const preview = useMemo(() => {
    if (!project) return null;
    try {
      return buildProjectSupplement(project, requestId, input, new Date().toISOString());
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, requestId, description, quantity, unit, unitPrice]);

  const save = () =>
    void run(
      'supplement:add',
      async () => {
        await useProjectStore.getState().addSupplement(projectId, requestId, input);
        router.back();
      },
      { feedback: 'success', fallback: 'No se ha podido guardar la ampliación.' },
    );

  return (
    <>
      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        testID="supplement-sheet"
      >
        <Card style={styles.card}>
          <TextField
            label="Partida imprevista"
            value={description}
            onChangeText={setDescription}
            maxLength={300}
            autoCapitalize="sentences"
            testID="supplement-description"
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                label="Cantidad"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                testID="supplement-quantity"
              />
            </View>
            <View style={styles.half}>
              <TextField
                label="Precio unitario sin IVA"
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="decimal-pad"
                testID="supplement-price"
              />
            </View>
          </View>
          <UnitPicker value={unit} onChange={setUnit} disabled={!!busy} />
          <Text variant="caption" tone="muted">
            Se aplica el IVA del presupuesto aceptado. El precio no vuelve a recibir el ajuste
            global del presupuesto.
          </Text>
        </Card>
        {preview ? (
          <Card style={styles.card} testID="supplement-preview">
            <View style={styles.amountRow}>
              <Text variant="label" tone="muted" weight="regular">
                Neto
              </Text>
              <Text style={styles.tabular}>{formatEuros(preview.subtotal)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text variant="label" tone="muted" weight="regular">
                IVA
              </Text>
              <Text style={styles.tabular}>{formatEuros(preview.iva)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text weight="semibold" tone="strong">
                Total
              </Text>
              <Text
                weight="semibold"
                tone="strong"
                style={styles.tabular}
                testID="supplement-total"
              >
                {formatEuros(preview.total)}
              </Text>
            </View>
          </Card>
        ) : null}
        {error ? (
          <Notice tone="danger" plain testID="supplement-error">
            {error}
          </Notice>
        ) : null}
        <Button
          label="Guardar ampliación"
          fullWidth
          disabled={!preview || !!busy}
          loading={busy === 'supplement:add'}
          onPress={save}
          testID="supplement-save"
        />
      </KeyboardAwareScrollView>
      <KeyboardToolbar>
        <KeyboardToolbar.Prev />
        <KeyboardToolbar.Next />
        <KeyboardToolbar.Done text="Hecho" />
      </KeyboardToolbar>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  card: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[3] },
  half: { flex: 1 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  tabular: { fontVariant: ['tabular-nums'] },
});

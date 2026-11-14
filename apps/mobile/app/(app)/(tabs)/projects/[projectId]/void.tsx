import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { formatEuros } from '@bg/domain';
import { colors, spacing } from '@bg/ui-tokens';
import { useProjectMutation } from '../../../../../src/features/projects/mutations';
import { useProjectStore } from '../../../../../src/state/stores';
import { Button, Card, Notice, Text, TextField } from '../../../../../src/ui';

/**
 * «Anular ampliación» (web inline void form) as a native sheet: the supplement stays in the history
 * with the date and the reason, and stops counting in the updated total and the progress.
 */
export default function VoidSupplementSheet() {
  const { projectId = '', supplementId = '' } = useLocalSearchParams<{
    projectId: string;
    supplementId: string;
  }>();
  const supplement = useProjectStore((state) =>
    state.activeProject?.id === projectId
      ? state.activeProject.supplements.find((item) => item.id === supplementId)
      : undefined,
  );
  const [reason, setReason] = useState('');
  const { busy, error, run } = useProjectMutation();

  const confirm = () =>
    void run(
      'supplement:void',
      async () => {
        await useProjectStore.getState().voidSupplement(projectId, supplementId, reason);
        router.back();
      },
      { feedback: 'success', fallback: 'No se ha podido anular la ampliación.' },
    );

  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      testID="void-sheet"
    >
      {supplement ? (
        <Card style={styles.card}>
          <Text weight="semibold">{supplement.description}</Text>
          <Text variant="label" tone="muted" weight="regular">
            {`${formatEuros(supplement.total)} · IVA incluido`}
          </Text>
        </Card>
      ) : null}
      <TextField
        label="Motivo de anulación"
        value={reason}
        onChangeText={setReason}
        maxLength={500}
        multiline
        autoCapitalize="sentences"
        testID="void-reason"
      />
      <Text variant="caption" tone="muted">
        La ampliación seguirá en el historial con el motivo y dejará de contar en el total
        actualizado.
      </Text>
      {error ? (
        <Notice tone="danger" plain testID="void-error">
          {error}
        </Notice>
      ) : null}
      <Button
        label="Confirmar anulación"
        variant="danger"
        fullWidth
        disabled={!supplement || !reason.trim() || !!busy}
        loading={busy === 'supplement:void'}
        onPress={confirm}
        testID="void-confirm"
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  card: { gap: spacing[1] },
});

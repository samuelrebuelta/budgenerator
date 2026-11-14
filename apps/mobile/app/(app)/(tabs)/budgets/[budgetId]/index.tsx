import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { flushWrites } from '@bg/app-core/sync';
import { t } from '@bg/domain/i18n';
import { toUserMessage } from '@bg/domain/lib/errors';
import { colors, spacing } from '@bg/ui-tokens';
import { BudgetEditor } from '../../../../../src/features/budgets/BudgetEditor';
import { BudgetLimitReached } from '../../../../../src/features/budgets/BudgetLimitReached';
import { DRAFT_ID, useEditorRecord } from '../../../../../src/features/budgets/editing';
import { draftHasContent } from '../../../../../src/features/budgets/model';
import { useSaveStatus } from '../../../../../src/features/budgets/offline';
import { useSession } from '../../../../../src/session';
import { useBudgetStore, useNetworkStore, useUserStore } from '../../../../../src/state/stores';
import { Button, Icon, LoadingScreen, Notice, Screen, Text } from '../../../../../src/ui';

function SaveStatusLabel({ budgetId }: { budgetId: string }) {
  const { uid } = useSession();
  const status = useSaveStatus(uid, budgetId);
  if (status === 'idle') return null;
  const label =
    status === 'saving' ? 'Guardando…' : status === 'saved' ? 'Guardado' : 'Sin guardar';
  return (
    <View
      style={styles.status}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      testID="budget-save-status"
    >
      <Icon
        name={status === 'error' ? 'cloud-off' : 'cloud'}
        size={16}
        color={status === 'error' ? colors['danger-ink'] : colors['ink-muted']}
      />
      <Text variant="caption" tone={status === 'error' ? 'danger' : 'muted'}>
        {label}
      </Text>
    </View>
  );
}

function SaveErrorNotice({ budgetId }: { budgetId: string }) {
  const { uid } = useSession();
  const status = useSaveStatus(uid, budgetId);
  if (status !== 'error') return null;
  return (
    <Notice tone="danger" title="No se han podido guardar los cambios" icon="cloud-off">
      <Text variant="label" weight="regular" tone="danger">
        Comprueba la conexión y reintenta.
      </Text>
      <Button
        label="Reintentar"
        variant="secondary"
        onPress={() => void flushWrites().catch(() => {})}
      />
    </Notice>
  );
}

function ConflictNotice({ budgetId }: { budgetId: string }) {
  const conflict = useBudgetStore((state) => state.conflicts.includes(budgetId));
  const [error, setError] = useState('');
  if (!conflict) return null;
  const run = (action: () => Promise<void>, fallback: string) => {
    setError('');
    void action().catch((e: unknown) => setError(toUserMessage(e, fallback)));
  };
  return (
    <Notice tone="warning" title="Este presupuesto se ha guardado desde otro dispositivo.">
      <Text variant="label" weight="regular">
        Tus últimos cambios no se han guardado para no sobrescribir la otra versión. Elige qué
        versión conservar.
      </Text>
      <View style={styles.actions}>
        <Button
          label="Cargar la versión guardada"
          variant="secondary"
          onPress={() =>
            run(() => useBudgetStore.getState().reloadBudget(budgetId), 'No se ha podido recargar.')
          }
        />
        <Button
          label="Guardar mis cambios"
          onPress={() =>
            run(
              () => useBudgetStore.getState().overwriteBudget(budgetId),
              'No se ha podido guardar.',
            )
          }
        />
      </View>
      {error ? (
        <Text variant="label" tone="danger">
          {error}
        </Text>
      ) : null}
    </Notice>
  );
}

/**
 * Budget detail and editor (web `BudgetDetailPage`). `new` is the unsaved draft: it checks the Free
 * quota first (D7: the limit without a purchase call), saves with «Guardar» and asks before
 * leaving with changes. Saved budgets save themselves through the `WriteQueue` with the session
 * revision, showing «Guardando… / Guardado» in the header.
 */
export default function BudgetScreen() {
  const { budgetId = DRAFT_ID } = useLocalSearchParams<{ budgetId: string }>();
  const isDraft = budgetId === DRAFT_ID;
  const navigation = useNavigation();
  const record = useEditorRecord(budgetId);
  const loaded = useBudgetStore((state) => state.loaded);
  const savingDraft = useBudgetStore((state) => state.savingDraft);
  const online = useNetworkStore((state) => state.online);
  const userData = useUserStore((state) => state.userData);
  const canCreate = useUserStore((state) => state.canCreateBudget)();
  const hasContent = useBudgetStore((state) => isDraft && draftHasContent(state.draft));
  const [saveError, setSaveError] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    const store = useBudgetStore.getState();
    if (isDraft) {
      if (store.draft === null && useUserStore.getState().canCreateBudget()) store.startDraft();
      return;
    }
    store.setActiveBudget(budgetId);
    return () => useBudgetStore.getState().setActiveBudget(null);
  }, [budgetId, isDraft]);

  // Leaving an empty draft drops it, so the store edits the saved budget opened next.
  useEffect(
    () => () => {
      if (!isDraft) return;
      const { draft, discardDraft } = useBudgetStore.getState();
      if (draft && !draftHasContent(draft)) discardDraft();
    },
    [isDraft],
  );

  useEffect(() => {
    if (savedId) router.replace({ pathname: '/budgets/[budgetId]', params: { budgetId: savedId } });
  }, [savedId]);

  usePreventRemove(isDraft && hasContent && !savedId && !savingDraft, ({ data }) => {
    Alert.alert(t('budget.discard'), t('budget.unsavedChanges'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('budget.discard'),
        style: 'destructive',
        onPress: () => {
          useBudgetStore.getState().discardDraft();
          navigation.dispatch(data.action);
        },
      },
    ]);
  });

  const save = async () => {
    setSaveError('');
    try {
      const id = await useBudgetStore.getState().saveDraft();
      if (id) setSavedId(id);
    } catch (error) {
      if ((error as { code?: string }).code !== 'offline/no-connection')
        setSaveError(toUserMessage(error, 'No se ha podido guardar. Vuelve a intentarlo.'));
    }
  };

  const title = isDraft ? 'Nuevo presupuesto' : 'Presupuesto';

  if (isDraft && !canCreate && !record)
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen edges={[]}>
          <BudgetLimitReached totalBudgetsCreated={userData?.totalBudgetsCreated ?? 0} />
          <Button label="Volver a presupuestos" variant="secondary" onPress={() => router.back()} />
        </Screen>
      </>
    );

  if (!isDraft && !loaded)
    return (
      <>
        <Stack.Screen options={{ title }} />
        {online ? (
          <LoadingScreen />
        ) : (
          <LoadingScreen message="El contenido de este presupuesto aún no está disponible en esta sesión. Conéctate a internet para abrirlo." />
        )}
      </>
    );

  if (!record)
    return (
      <>
        <Stack.Screen options={{ title }} />
        {isDraft ? (
          <LoadingScreen />
        ) : (
          <Screen edges={[]}>
            <Text tone="muted">No se ha encontrado el presupuesto. Puede que se haya borrado.</Text>
            <Button
              label="Volver a presupuestos"
              variant="secondary"
              onPress={() => router.back()}
            />
          </Screen>
        )}
      </>
    );

  const notices = (
    <>
      {isDraft ? (
        <Notice tone="warning" plain>
          {`${t('budget.draftBanner')} ${t('budget.draftBannerBold')}.`}
        </Notice>
      ) : null}
      {saveError ? (
        <Notice tone="danger" plain testID="budget-save-error">
          {saveError}
        </Notice>
      ) : null}
      {!isDraft ? <SaveErrorNotice budgetId={budgetId} /> : null}
      {!isDraft ? <ConflictNotice budgetId={budgetId} /> : null}
      {record.projectId ? (
        <Notice tone="success" title="Presupuesto convertido en proyecto">
          La oferta aceptada permanece aquí como documento de referencia.
        </Notice>
      ) : record.acceptedAt ? (
        <Notice
          tone="info"
          title={`Presupuesto aceptado el ${new Date(record.acceptedAt).toLocaleDateString('es-ES')}.`}
        >
          Puedes retirarlo para volver a editar. La conversión en proyecto se hace de momento desde
          la web.
        </Notice>
      ) : null}
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () =>
            isDraft ? (
              <Button
                label={savingDraft ? 'Guardando…' : t('common.save')}
                variant="link"
                loading={savingDraft}
                onPress={() => void save()}
                testID="budget-save"
              />
            ) : (
              <SaveStatusLabel budgetId={budgetId} />
            ),
        }}
      />
      <BudgetEditor budgetId={budgetId} record={record} isDraft={isDraft} notices={notices} />
    </>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});

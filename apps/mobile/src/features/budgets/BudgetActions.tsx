import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { budgetView, type BudgetRecord } from '@bg/domain/budget/record';
import { t } from '@bg/domain/i18n';
import { toUserMessage } from '@bg/domain/lib/errors';
import { spacing } from '@bg/ui-tokens';
import {
  repositories,
  useAuthStore,
  useBudgetStore,
  useProfileStore,
  useProjectStore,
} from '../../state/stores';
import { Button, Card, Notice, Text } from '../../ui';
import { EmailVerificationNotice } from '../account/EmailVerificationNotice';
import { allowSavedMutation } from './offline';
import { shareBudgetPdf } from './pdf';
import { createPublicLink } from './publicLink';

const isOffline = (error: unknown) =>
  (error as { code?: string } | null)?.code === 'offline/no-connection';

/** Runs an action and turns its error into the inline message; the offline toast is enough. */
async function attempt(action: () => Promise<unknown>, onError: (message: string) => void) {
  try {
    await action();
  } catch (error) {
    if (!isOffline(error)) onError(toUserMessage(error, 'No se ha podido completar la acción.'));
  }
}

function confirm(title: string, message: string, label: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: label, onPress: onConfirm },
  ]);
}

/**
 * Actions of a saved budget (web `BudgetDetailPage` footer): PDF through the native share sheet,
 * public link (verified email), acceptance and its withdrawal, a copy of a converted budget and
 * deletion. An accepted budget converts into a project with the shared transaction (blocked
 * offline with the BG-012 toast) and opens it in the Projects tab (registro BG-014, paso 9).
 */
export function BudgetActions({ record }: { record: BudgetRecord }) {
  const company = useProfileStore((state) => state.profile);
  const refreshVerification = useAuthStore((state) => state.refreshVerification);
  const [busy, setBusy] = useState<'pdf' | 'link' | 'accept' | 'convert' | null>(null);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [link, setLink] = useState<{ token: string; url: string } | null>(null);
  const store = useBudgetStore.getState;

  const run = (kind: 'pdf' | 'link' | 'accept' | 'convert', action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(kind);
    setError('');
    void attempt(action, setError).finally(() => setBusy(null));
  };

  const exportPdf = () => run('pdf', () => shareBudgetPdf(budgetView(record), company));

  const share = () =>
    run('link', async () => {
      const result = await createPublicLink(record, company, {
        refreshVerification,
        shareBudget: repositories.budget.shareBudget,
      });
      if (result.status === 'unverified') setNeedsVerification(true);
      else {
        setNeedsVerification(false);
        setLink({ token: result.token, url: result.url });
      }
    });

  const revoke = () =>
    confirm(
      '¿Revocar este enlace?',
      'Dejará de estar disponible para cualquier persona que lo tenga.',
      'Revocar enlace',
      () =>
        void attempt(async () => {
          if (link) await repositories.budget.revokeSharedBudget(link.token);
          setLink(null);
        }, setError),
    );

  const accept = () =>
    confirm(
      '¿Marcar como aceptado?',
      'El presupuesto quedará bloqueado para edición. Podrás retirar la aceptación mientras no se haya convertido en proyecto.',
      'Marcar como aceptado',
      () => run('accept', () => store().acceptBudget(record.id)),
    );

  const withdraw = () =>
    confirm(
      '¿Retirar la aceptación?',
      'El presupuesto volverá a ser editable y podrás modificar la oferta.',
      'Retirar aceptación',
      () => run('accept', () => store().withdrawBudgetAcceptance(record.id)),
    );

  const convert = () =>
    confirm(
      '¿Convertir en proyecto?',
      'Se guardará una copia independiente de esta oferta para seguir el avance. El presupuesto quedará como referencia de solo lectura.',
      'Convertir en proyecto',
      () => {
        if (!allowSavedMutation()) return;
        run('convert', async () => {
          const projectId = await useProjectStore.getState().convertBudgetToProject(record.id);
          router.push({ pathname: '/projects/[projectId]', params: { projectId } });
        });
      },
    );

  const remove = () =>
    Alert.alert(t('budget.deleteConfirmTitle'), t('budget.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void attempt(async () => {
            await store().deleteBudget(record.id);
            router.back();
          }, setError),
      },
    ]);

  const copy = () => {
    if (!allowSavedMutation()) return;
    store().startDraftFromBudget(record.id);
    router.push({ pathname: '/budgets/[budgetId]', params: { budgetId: 'new' } });
  };

  return (
    <View style={styles.box}>
      {needsVerification ? (
        <EmailVerificationNotice reason="Hasta entonces no podrás crear enlaces públicos." />
      ) : null}
      {error ? (
        <Notice tone="danger" plain testID="budget-action-error">
          {error}
        </Notice>
      ) : null}
      <Card style={styles.group}>
        <Button
          label={t('export.button')}
          icon="share"
          variant="secondary"
          fullWidth
          loading={busy === 'pdf'}
          onPress={exportPdf}
          testID="budget-export-pdf"
        />
        <Button
          label={busy === 'link' ? 'Preparando…' : 'Crear enlace público'}
          icon="link"
          variant="secondary"
          fullWidth
          loading={busy === 'link'}
          onPress={share}
          testID="budget-share-link"
        />
        {link ? (
          <View style={styles.link}>
            <Text variant="caption" tone="muted">
              Enlace de esta versión · válido durante 30 días.
            </Text>
            <View style={styles.inline}>
              <Button
                label="Abrir enlace"
                variant="link"
                onPress={() => void Linking.openURL(link.url)}
              />
              <Button label="Revocar" variant="link" onPress={revoke} />
            </View>
          </View>
        ) : null}
      </Card>
      <View style={styles.group}>
        {record.projectId ? (
          <Button
            label="Crear copia para editar"
            icon="copy"
            variant="secondary"
            fullWidth
            onPress={copy}
          />
        ) : record.acceptedAt ? (
          <>
            <Button
              label="Convertir en proyecto"
              icon="briefcase"
              fullWidth
              loading={busy === 'convert'}
              onPress={convert}
              testID="budget-convert"
            />
            <Button
              label="Retirar aceptación"
              variant="secondary"
              fullWidth
              loading={busy === 'accept'}
              onPress={withdraw}
              testID="budget-withdraw"
            />
          </>
        ) : (
          <Button
            label="Marcar como aceptado"
            icon="check-circle"
            fullWidth
            loading={busy === 'accept'}
            onPress={accept}
            testID="budget-accept"
          />
        )}
        {!record.projectId && !record.acceptedAt ? (
          <Button
            label={t('budget.deleteBudget')}
            icon="trash-2"
            variant="danger"
            fullWidth
            onPress={remove}
            testID="budget-delete"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[3] },
  group: { gap: spacing[2] },
  link: { gap: spacing[1] },
  inline: { flexDirection: 'row', gap: spacing[2] },
});

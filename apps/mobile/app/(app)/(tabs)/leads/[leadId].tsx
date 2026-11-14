import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  deleteMemoryResource,
  getMemoryResource,
  setMemoryResource,
} from '@bg/app-core/memoryResourceCache';
import { formatCents, formatDateTime } from '@bg/domain';
import { toUserMessage } from '@bg/domain/lib/errors';
import type { QuoteLead } from '@bg/domain/quote-estimator/types';
import { colors, spacing } from '@bg/ui-tokens';
import { allowSavedMutation } from '../../../../src/features/budgets/offline';
import { LeadBudgetBadge } from '../../../../src/features/leads/LeadListRow';
import {
  emailUrl,
  leadKey,
  leadsKey,
  phoneUrl,
  selectionSummary,
  startTimingLabel,
  validLeadId,
  whatsappUrl,
} from '../../../../src/features/leads/model';
import { useLeadResource } from '../../../../src/features/leads/useLeadResource';
import { haptic } from '../../../../src/features/projects/mutations';
import { useSession } from '../../../../src/session';
import {
  repositories,
  useBudgetStore,
  useNetworkStore,
  useUserStore,
} from '../../../../src/state/stores';
import {
  Button,
  Card,
  ListGroup,
  ListRow,
  LoadingScreen,
  Notice,
  Screen,
  Text,
} from '../../../../src/ui';

/** Opens a contact URL; the simulator (no Phone app) or a missing app shows an alert instead. */
async function openContact(url: string, what: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`No se ha podido abrir ${what}`, 'Comprueba que tienes una aplicación instalada.');
  }
}

/**
 * «Crear presupuesto» (web `/budget/new?leadId=…`): opens the draft prefilled with the client name
 * and linked to the lead (`startDraftFromLead`), so saving it sets `budgetId` on the lead in the
 * same transaction. Without quota the draft screen shows the plan limit (D7, no purchase call).
 * The draft is local until «Guardar», so it also opens offline (D4 blocks only saved data).
 */
function createBudgetFrom(lead: QuoteLead) {
  if (useUserStore.getState().canCreateBudget()) useBudgetStore.getState().startDraftFromLead(lead);
  router.navigate({ pathname: '/budgets/[budgetId]', params: { budgetId: 'new' } });
}

function Unavailable({ children, testID }: { children: string; testID: string }) {
  return (
    <>
      <Stack.Screen options={{ title: 'Solicitud no disponible' }} />
      <Screen edges={[]}>
        <Notice tone="info" plain testID={testID}>
          {children}
        </Notice>
        <Button
          label="Volver a solicitudes"
          variant="secondary"
          onPress={() => router.navigate('/leads')}
        />
      </Screen>
    </>
  );
}

/**
 * Lead detail. The web shows every lead as a card of `/profile/solicitudes` and highlights the one
 * of `?leadId=`; the app gives it its own screen with the same data (contact, requested work,
 * start, orientative range) and actions: call, email and WhatsApp (system apps through `Linking`),
 * create or open the budget, and delete with confirmation. Deleting is blocked offline with the
 * BG-012 toast (D4); the repository guard would block it as well.
 */
export default function LeadScreen() {
  const params = useLocalSearchParams<{ leadId: string }>();
  const leadId = validLeadId(params.leadId);
  const { uid } = useSession();
  const online = useNetworkStore((state) => state.online);
  const budgets = useBudgetStore((state) => state.records);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const key = uid && leadId ? leadKey(uid, leadId) : null;
  const resource = useLeadResource<QuoteLead | null>(
    key,
    async () => {
      if (!uid || !leadId) return null;
      return repositories.quoteEstimator.fetchLead(uid, leadId);
    },
    { errorMessage: 'No se ha podido cargar la solicitud. Vuelve a intentarlo.' },
  );
  // Opened from the list before its own cache entry exists: the list copy is enough to show it.
  const fromList =
    uid && leadId
      ? getMemoryResource<QuoteLead[]>(leadsKey(uid))?.find((item) => item.id === leadId)
      : undefined;
  const lead = resource.data === undefined ? fromList : resource.data;

  if (!leadId)
    return (
      <Unavailable testID="lead-invalid">
        La solicitud solicitada no está disponible en esta cuenta.
      </Unavailable>
    );

  if (lead === undefined) {
    if (resource.status === 'offline')
      return (
        <>
          <Stack.Screen options={{ title: 'Solicitud' }} />
          <LoadingScreen message="El contenido de esta solicitud aún no está disponible en esta sesión. Conéctate a internet para abrirla." />
        </>
      );
    if (resource.status === 'error')
      return (
        <>
          <Stack.Screen options={{ title: 'Solicitud' }} />
          <LoadingScreen error={resource.error} onRetry={resource.retry} />
        </>
      );
    return (
      <>
        <Stack.Screen options={{ title: 'Solicitud' }} />
        <LoadingScreen />
      </>
    );
  }

  if (lead === null)
    return (
      <Unavailable testID="lead-not-found">
        No se ha encontrado la solicitud. Puede que se haya borrado o que ya no tengas acceso.
      </Unavailable>
    );

  const linkedBudget = lead.budgetId
    ? budgets.find((budget) => budget.id === lead.budgetId)
    : undefined;
  const whatsapp = whatsappUrl(lead.contact.phone);
  const timing = startTimingLabel(lead);
  const range = `${formatCents(lead.estimate.minimumCents)} – ${formatCents(lead.estimate.maximumCents)}`;

  const remove = async () => {
    if (!uid) return;
    setDeleting(true);
    setActionError('');
    try {
      await repositories.quoteEstimator.deleteLead(uid, lead.id);
      haptic('success');
      const list = getMemoryResource<QuoteLead[]>(leadsKey(uid));
      if (list)
        await setMemoryResource(
          leadsKey(uid),
          list.filter((item) => item.id !== lead.id),
        );
      await deleteMemoryResource(leadKey(uid, lead.id));
      router.back();
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== 'offline/no-connection')
        setActionError(toUserMessage(error, 'No se ha podido borrar la solicitud.'));
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (deleting) return;
    if (!allowSavedMutation()) {
      haptic('warning');
      return;
    }
    Alert.alert(
      'Borrar solicitud',
      'Se borrarán los datos de contacto y la información de la reforma. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => void remove() },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Solicitud' }} />
      <Screen edges={[]}>
        {!online ? (
          <Notice tone="warning" title="Sin conexión" icon="wifi-off" testID="lead-offline-notice">
            Ves la última copia guardada en este dispositivo. Para borrar la solicitud, conéctate.
          </Notice>
        ) : null}
        {actionError ? (
          <Notice tone="danger" plain testID="lead-action-error">
            {actionError}
          </Notice>
        ) : null}

        <View style={styles.heading}>
          <Text variant="display" tone="strong" testID="lead-name" accessibilityRole="header">
            {lead.contact.name}
          </Text>
          <View style={styles.headingMeta}>
            <LeadBudgetBadge budgeted={Boolean(lead.budgetId)} />
            <Text variant="label" tone="muted" weight="regular">
              {`Recibida el ${formatDateTime(lead.createdAt)}`}
            </Text>
          </View>
        </View>

        <ListGroup>
          <ListRow
            icon="phone"
            title="Llamar"
            subtitle={lead.contact.phone}
            accessibilityLabel={`Llamar a ${lead.contact.phone}`}
            onPress={() => void openContact(phoneUrl(lead.contact.phone), 'el teléfono')}
            testID="lead-call"
          />
          {whatsapp ? (
            <ListRow
              icon="message-circle"
              title="WhatsApp"
              subtitle={lead.contact.phone}
              accessibilityLabel={`Escribir por WhatsApp a ${lead.contact.phone}`}
              onPress={() => void openContact(whatsapp, 'WhatsApp')}
              testID="lead-whatsapp"
            />
          ) : null}
          <ListRow
            icon="mail"
            title="Email"
            subtitle={lead.contact.email}
            accessibilityLabel={`Enviar un email a ${lead.contact.email}`}
            onPress={() => void openContact(emailUrl(lead.contact.email), 'el correo')}
            testID="lead-email"
          />
        </ListGroup>

        <Card style={styles.card}>
          <Text variant="caption" weight="semibold" tone="muted" style={styles.overline}>
            REFORMA SOLICITADA
          </Text>
          <View style={styles.lines} testID="lead-selections">
            {selectionSummary(lead).map((line) => (
              <Text key={line} variant="label" weight="regular">
                {line}
              </Text>
            ))}
          </View>
          {timing ? (
            <Text variant="label" weight="regular" testID="lead-start-timing">
              {`Inicio previsto: ${timing}`}
            </Text>
          ) : null}
          <View>
            <Text variant="label" tone="muted" weight="regular">
              Horquilla orientativa
            </Text>
            <Text variant="title" style={styles.range} testID="lead-range">
              {range}
              <Text variant="caption" tone="muted">
                {'  sin IVA'}
              </Text>
            </Text>
          </View>
        </Card>

        <View style={styles.actions}>
          {linkedBudget ? (
            <Button
              label="Abrir presupuesto"
              icon="file-text"
              variant="secondary"
              onPress={() =>
                router.navigate({
                  pathname: '/budgets/[budgetId]',
                  params: { budgetId: linkedBudget.id },
                })
              }
              testID="lead-open-budget"
            />
          ) : (
            <Button
              label="Crear presupuesto"
              icon="file-text"
              onPress={() => createBudgetFrom(lead)}
              testID="lead-create-budget"
            />
          )}
          {lead.budgetId && !linkedBudget ? (
            <Text variant="caption" tone="muted" style={styles.center}>
              El presupuesto enlazado ya no está disponible.
            </Text>
          ) : null}
          <Button
            label="Borrar"
            icon="trash-2"
            variant="ghost"
            loading={deleting}
            accessibilityLabel="Borrar solicitud"
            onPress={confirmDelete}
            testID="lead-delete"
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing[2] },
  headingMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[3] },
  overline: { letterSpacing: 1.2 },
  lines: { gap: spacing[1] },
  range: { color: colors.primary },
  actions: { gap: spacing[2] },
  center: { textAlign: 'center' },
});

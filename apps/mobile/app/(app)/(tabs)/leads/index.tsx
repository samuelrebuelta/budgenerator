import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { setMemoryResource } from '@bg/app-core/memoryResourceCache';
import type { QuoteLead } from '@bg/domain/quote-estimator/types';
import { colors, spacing } from '@bg/ui-tokens';
import { LeadListRow } from '../../../../src/features/leads/LeadListRow';
import {
  filterLeads,
  LEAD_FILTERS,
  leadKey,
  leadsKey,
  validLeadId,
  type LeadFilter,
} from '../../../../src/features/leads/model';
import { useLeadResource } from '../../../../src/features/leads/useLeadResource';
import { useSession } from '../../../../src/session';
import { repositories, useNetworkStore } from '../../../../src/state/stores';
import { Button, Icon, Notice, Text } from '../../../../src/ui';

const EMPTY: QuoteLead[] = [];

function openLead(id: string) {
  router.push({ pathname: '/leads/[leadId]', params: { leadId: id } });
}

function FilterChips({
  filter,
  onChange,
}: {
  filter: LeadFilter;
  onChange: (filter: LeadFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      accessibilityRole="tablist"
    >
      {LEAD_FILTERS.map((option) => {
        const selected = option.value === filter;
        return (
          <Button
            key={option.value || 'all'}
            label={option.label}
            variant={selected ? 'secondary' : 'ghost'}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            testID={`leads-filter-${option.value || 'all'}`}
          />
        );
      })}
    </ScrollView>
  );
}

function StateMessage({
  icon,
  title,
  children,
  testID,
}: {
  icon: 'wifi-off' | 'search' | 'inbox';
  title: string;
  children: string;
  testID: string;
}) {
  return (
    <View style={styles.state} testID={testID}>
      <Icon name={icon} size={32} color={colors['ink-muted']} />
      <Text variant="title" tone="strong" style={styles.center}>
        {title}
      </Text>
      <Text tone="muted" style={styles.center}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Leads tab (web `LeadsPage`, `/profile/solicitudes`): requests received through the public
 * estimator, newest first, with the list patterns of Budgets and Projects: FlashList, the system
 * search field, filter chips, pull to refresh and the BG-012 states (loading, offline without
 * data, empty, no results, error with «Reintentar» and the offline notice over the saved copy).
 * Reads go through the shared memory/offline cache, so the last list opens offline.
 */
export default function LeadsScreen() {
  const { uid } = useSession();
  const { notice, leadId } = useLocalSearchParams<{ notice?: string; leadId?: string }>();
  const online = useNetworkStore((state) => state.online);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LeadFilter>('');
  const [refreshing, setRefreshing] = useState(false);
  const resource = useLeadResource(
    uid ? leadsKey(uid) : null,
    () => repositories.quoteEstimator.fetchLeads(uid!),
    {
      errorMessage: 'No se han podido cargar las solicitudes. Vuelve a intentarlo.',
      onLoaded: (leads) => {
        for (const lead of leads) void setMemoryResource(leadKey(uid!, lead.id), lead);
      },
    },
  );
  const leads = resource.data ?? EMPTY;

  // Deep link or notification (`/profile/solicitudes?leadId=…`): open the detail over the list.
  useEffect(() => {
    const requested = validLeadId(leadId);
    if (!requested) return;
    router.setParams({ leadId: undefined });
    openLead(requested);
  }, [leadId]);
  const entries = useMemo(() => filterLeads(leads, search, filter), [leads, search, filter]);
  const filtered = !!search.trim() || !!filter;
  const error = online ? resource.error : '';

  const refresh = useCallback(() => {
    if (!online) return;
    setRefreshing(true);
    resource.retry();
    // The resource revalidates in the background; the spinner only acknowledges the gesture.
    setTimeout(() => setRefreshing(false), 400);
  }, [online, resource]);

  const header = (
    <View style={styles.header}>
      {notice === 'unavailable' ? (
        <Notice tone="info" plain testID="leads-unavailable-notice">
          La solicitud solicitada no está disponible en esta cuenta.
        </Notice>
      ) : null}
      {!online ? (
        <Notice tone="warning" title="Sin conexión" icon="wifi-off" testID="leads-offline-notice">
          Ves la última copia guardada en este dispositivo. Para borrar solicitudes, conéctate.
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" testID="leads-error">
          <Text variant="label" weight="regular" tone="danger">
            {error}
          </Text>
          <Button label="Reintentar" variant="secondary" onPress={resource.retry} />
        </Notice>
      ) : null}
      {leads.length ? <FilterChips filter={filter} onChange={setFilter} /> : null}
    </View>
  );

  const empty =
    resource.status === 'offline' ? (
      <StateMessage
        icon="wifi-off"
        title="Contenido no disponible sin conexión"
        testID="leads-offline-unavailable"
      >
        Esta pantalla aún no tiene datos cargados en esta sesión. Conéctate a internet para abrirla.
      </StateMessage>
    ) : resource.status === 'loading' || resource.status === 'idle' ? (
      <View style={styles.state} testID="leads-loading">
        <Text tone="muted">Cargando solicitudes…</Text>
      </View>
    ) : resource.status === 'error' ? null : filtered ? (
      <StateMessage icon="search" title="Sin resultados" testID="leads-no-results">
        No encontramos solicitudes con esos datos.
      </StateMessage>
    ) : (
      <View style={styles.state} testID="leads-empty">
        <Icon name="inbox" size={32} color={colors['ink-muted']} />
        <Text variant="title" tone="strong" style={styles.center}>
          Aún no has recibido solicitudes
        </Text>
        <Text tone="muted" style={styles.center}>
          Publica tu formulario de solicitudes y compártelo por WhatsApp, con un código QR o en tu
          web. Tus clientes verán una estimación orientativa y aquí te llegarán sus datos y lo que
          quieren reformar.
        </Text>
        <Button
          label="Configurar formulario de solicitudes"
          variant="secondary"
          icon="grid"
          onPress={() =>
            router.push({ pathname: '/menu/[section]', params: { section: 'estimator' } })
          }
        />
      </View>
    );

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: 'Nombre, email, teléfono o reforma',
            hideWhenScrolling: false,
            autoCapitalize: 'none',
            onChangeText: (event) => setSearch(event.nativeEvent.text),
            onCancelButtonPress: () => setSearch(''),
          },
        }}
      />
      <FlashList
        data={entries}
        keyExtractor={(lead) => lead.id}
        renderItem={({ item }) => <LeadListRow lead={item} onOpen={openLead} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        testID="leads-list"
      />
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.canvas },
  header: { padding: spacing[4], gap: spacing[3] },
  chips: { gap: spacing[2] },
  state: { alignItems: 'center', gap: spacing[3], padding: spacing[8] },
  center: { textAlign: 'center' },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing[4],
    backgroundColor: colors.line,
  },
});

import { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { formatEuros } from '@bg/domain';
import { t } from '@bg/domain/i18n';
import { toUserMessage } from '@bg/domain/lib/errors';
import { colors, spacing } from '@bg/ui-tokens';
import { EmailVerificationNotice } from '../../../../src/features/account/EmailVerificationNotice';
import { BudgetListRow } from '../../../../src/features/budgets/BudgetListRow';
import {
  budgetYears,
  filterBudgets,
  type BudgetListEntry,
} from '../../../../src/features/budgets/model';
import { AccountMenuButton } from '../../../../src/navigation/AccountMenuButton';
import { HeaderIconButton } from '../../../../src/navigation/HeaderIconButton';
import { useSession } from '../../../../src/session';
import { useBudgetStore, useNetworkStore } from '../../../../src/state/stores';
import { Button, Card, Icon, Notice, Text } from '../../../../src/ui';

function openBudget(id: string) {
  router.push({ pathname: '/budgets/[budgetId]', params: { budgetId: id } });
}

/** «Nuevo presupuesto»: the draft screen checks the Free quota (and shows the limit) like the web. */
function createBudget() {
  router.push({ pathname: '/budgets/[budgetId]', params: { budgetId: 'new' } });
}

function confirmDelete(entry: BudgetListEntry) {
  Alert.alert(t('budget.deleteConfirmTitle'), t('budget.deleteConfirmMessage'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.delete'),
      style: 'destructive',
      onPress: () =>
        void useBudgetStore
          .getState()
          .deleteBudget(entry.record.id)
          .catch((error: unknown) => {
            // The offline guard already showed the BG-012 toast.
            if ((error as { code?: string }).code !== 'offline/no-connection')
              Alert.alert(
                'No se ha podido borrar',
                toUserMessage(error, 'Vuelve a intentarlo en unos segundos.'),
              );
          }),
    },
  ]);
}

function YearChips({
  years,
  year,
  onChange,
}: {
  years: string[];
  year: string;
  onChange: (year: string) => void;
}) {
  if (years.length < 2) return null;
  const options = [
    { value: '', label: 'Todos los años' },
    ...years.map((v) => ({ value: v, label: v })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {options.map((option) => {
        const selected = option.value === year;
        return (
          <Button
            key={option.value || 'all'}
            label={option.label}
            variant={selected ? 'secondary' : 'ghost'}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
          />
        );
      })}
    </ScrollView>
  );
}

/**
 * Budgets tab (web `BudgetsPage`) with native patterns: FlashList, the system search field in the
 * header (UISearchController / M3 search), trailing swipe to delete, pull to refresh and the
 * BG-012 states (loading, offline without data, empty, no results).
 */
export default function BudgetsScreen() {
  const { uid } = useSession();
  const records = useBudgetStore((state) => state.records);
  const loaded = useBudgetStore((state) => state.loaded);
  const online = useNetworkStore((state) => state.online);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const entries = useMemo(() => filterBudgets(records, search, year), [records, search, year]);
  const years = useMemo(() => budgetYears(records), [records]);
  const filtered = !!search.trim() || !!year;
  const totalValue = entries.reduce((sum, entry) => sum + entry.total, 0);

  const refresh = useCallback(async () => {
    if (!uid || !online) return;
    setRefreshing(true);
    try {
      await useBudgetStore.getState().loadBudgets(uid);
    } catch {
      // The coordinator reports connectivity; the list keeps the last copy.
    } finally {
      setRefreshing(false);
    }
  }, [uid, online]);

  const header = (
    <View style={styles.header}>
      <EmailVerificationNotice />
      {!online ? (
        <Notice tone="warning" title="Sin conexión" icon="wifi-off" testID="budgets-offline-notice">
          Ves la última copia guardada en este dispositivo. Para guardar cambios, conéctate.
        </Notice>
      ) : null}
      {records.length ? (
        <Card style={styles.overview} accessibilityRole="summary">
          <Text variant="label" tone="muted">
            Valor presupuestado
          </Text>
          <Text variant="title" tone="strong" style={styles.amount} testID="budgets-total-value">
            {formatEuros(totalValue)}
          </Text>
          <Text variant="caption" tone="muted">
            {filtered
              ? `${entries.length} presupuestos coincidentes, IVA incluido`
              : `${entries.length} presupuestos guardados, IVA incluido`}
          </Text>
        </Card>
      ) : null}
      <YearChips years={years} year={year} onChange={setYear} />
    </View>
  );

  const empty = !loaded ? (
    online ? (
      <View style={styles.state} testID="budgets-loading">
        <Text tone="muted">Cargando presupuestos…</Text>
      </View>
    ) : (
      <View style={styles.state} testID="budgets-offline-unavailable">
        <Icon name="wifi-off" size={32} color={colors['ink-muted']} />
        <Text variant="title" tone="strong" style={styles.center}>
          Contenido no disponible sin conexión
        </Text>
        <Text tone="muted" style={styles.center}>
          Esta pantalla aún no tiene datos cargados en esta sesión. Conéctate a internet para
          abrirla.
        </Text>
      </View>
    )
  ) : (
    <View style={styles.state} testID="budgets-empty">
      <Icon name="file-text" size={32} color={colors['ink-muted']} />
      <Text variant="title" tone="strong" style={styles.center}>
        {filtered ? 'Sin resultados' : 'No hay presupuestos'}
      </Text>
      <Text tone="muted" style={styles.center}>
        {filtered
          ? 'No encontramos presupuestos con esos datos.'
          : 'Crea un presupuesto para empezar.'}
      </Text>
      {!filtered ? (
        <Button label="Crear mi primer presupuesto" icon="plus" onPress={createBudget} />
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <HeaderIconButton
                icon="plus"
                label="Crear presupuesto"
                onPress={createBudget}
                testID="budget-create-button"
              />
              <AccountMenuButton />
            </View>
          ),
          headerSearchBarOptions: {
            placeholder: 'Cliente, dirección, número o partida',
            hideWhenScrolling: false,
            autoCapitalize: 'none',
            onChangeText: (event) => setSearch(event.nativeEvent.text),
            onCancelButtonPress: () => setSearch(''),
          },
        }}
      />
      <FlashList
        data={entries}
        keyExtractor={(entry) => entry.record.id}
        renderItem={({ item }) => (
          <BudgetListRow entry={item} onOpen={openBudget} onDelete={() => confirmDelete(item)} />
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        testID="budgets-list"
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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  overview: { gap: spacing[1] },
  amount: { fontVariant: ['tabular-nums'] },
  chips: { gap: spacing[2] },
  state: { alignItems: 'center', gap: spacing[3], padding: spacing[8] },
  center: { textAlign: 'center' },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing[4],
    backgroundColor: colors.line,
  },
});

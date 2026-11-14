import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { colors, spacing } from '@bg/ui-tokens';
import {
  filterProjects,
  STATUS_FILTERS,
  type ProjectStatusFilter,
} from '../../../../src/features/projects/model';
import { ProjectListRow } from '../../../../src/features/projects/ProjectListRow';
import { useSession } from '../../../../src/session';
import { useNetworkStore, useProjectStore } from '../../../../src/state/stores';
import { Button, Icon, Notice, Text } from '../../../../src/ui';

function openProject(id: string) {
  router.push({ pathname: '/projects/[projectId]', params: { projectId: id } });
}

function StatusChips({
  status,
  onChange,
}: {
  status: ProjectStatusFilter;
  onChange: (status: ProjectStatusFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      accessibilityRole="tablist"
    >
      {STATUS_FILTERS.map((option) => {
        const selected = option.value === status;
        return (
          <Button
            key={option.value || 'all'}
            label={option.label}
            variant={selected ? 'secondary' : 'ghost'}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            testID={`projects-filter-${option.value || 'all'}`}
          />
        );
      })}
    </ScrollView>
  );
}

/**
 * Projects tab (web `ProjectsPage`) with the budgets list patterns: FlashList, the system search
 * field in the header, status filter chips, pull to refresh and the BG-012 states (loading,
 * offline without data, empty, no results and the offline notice over the saved copy).
 */
export default function ProjectsScreen() {
  const { uid } = useSession();
  const projects = useProjectStore((state) => state.projects);
  const loaded = useProjectStore((state) => state.loaded);
  const online = useNetworkStore((state) => state.online);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatusFilter>('');
  const [refreshing, setRefreshing] = useState(false);
  const entries = useMemo(
    () => filterProjects(projects, search, status),
    [projects, search, status],
  );
  const filtered = !!search.trim() || !!status;

  const refresh = useCallback(async () => {
    if (!uid || !online) return;
    setRefreshing(true);
    try {
      await useProjectStore.getState().loadProjects(uid, true);
    } catch {
      // The coordinator reports connectivity; the list keeps the last copy.
    } finally {
      setRefreshing(false);
    }
  }, [uid, online]);

  const header = (
    <View style={styles.header}>
      {!online ? (
        <Notice
          tone="warning"
          title="Sin conexión"
          icon="wifi-off"
          testID="projects-offline-notice"
        >
          Ves la última copia guardada en este dispositivo. Para marcar partidas o guardar cambios,
          conéctate.
        </Notice>
      ) : null}
      {projects.length ? <StatusChips status={status} onChange={setStatus} /> : null}
    </View>
  );

  const footer =
    loaded && entries.length > 0 ? (
      <Text variant="caption" tone="muted" style={styles.footer}>
        El avance se estima con los importes o partidas del presupuesto; no mide horas ni porcentaje
        físico de obra.
      </Text>
    ) : null;

  const empty =
    !loaded && projects.length === 0 ? (
      online ? (
        <View style={styles.state} testID="projects-loading">
          <Text tone="muted">Cargando proyectos…</Text>
        </View>
      ) : (
        <View style={styles.state} testID="projects-offline-unavailable">
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
    ) : filtered ? (
      <View style={styles.state} testID="projects-no-results">
        <Icon name="search" size={32} color={colors['ink-muted']} />
        <Text variant="title" tone="strong" style={styles.center}>
          Sin resultados
        </Text>
        <Text tone="muted" style={styles.center}>
          No encontramos proyectos con esos datos.
        </Text>
      </View>
    ) : (
      <View style={styles.state} testID="projects-empty">
        <Icon name="folder" size={32} color={colors['ink-muted']} />
        <Text variant="title" tone="strong" style={styles.center}>
          Aquí aparecerán tus proyectos
        </Text>
        <Text tone="muted" style={styles.center}>
          Cuando un cliente acepte un presupuesto, conviértelo en proyecto para marcar las partidas
          terminadas y consultar el avance.
        </Text>
        <Button
          label="Ver presupuestos"
          variant="secondary"
          icon="file-text"
          onPress={() => router.navigate('/budgets')}
        />
      </View>
    );

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: 'Cliente, obra o número',
            hideWhenScrolling: false,
            autoCapitalize: 'none',
            onChangeText: (event) => setSearch(event.nativeEvent.text),
            onCancelButtonPress: () => setSearch(''),
          },
        }}
      />
      <FlashList
        data={entries}
        keyExtractor={(project) => project.id}
        renderItem={({ item }) => <ProjectListRow project={item} onOpen={openProject} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
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
        testID="projects-list"
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
  footer: { padding: spacing[4] },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing[4],
    backgroundColor: colors.line,
  },
});

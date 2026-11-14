import { useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { getMemoryResource } from '@bg/app-core/memoryResourceCache';
import type { ProjectDetail, ProjectTask, ProjectWorkItem } from '@bg/domain/project/types';
import { colors, spacing } from '@bg/ui-tokens';
import { projectSubtitle, projectTitle } from '../../../../../src/features/projects/model';
import {
  projectErrorMessage,
  useProjectMutation,
} from '../../../../../src/features/projects/mutations';
import { ProjectSummaryCard } from '../../../../../src/features/projects/ProjectSummaryCard';
import { SupplementsCard } from '../../../../../src/features/projects/SupplementsCard';
import { TaskRow, WorkItemHeader } from '../../../../../src/features/projects/WorkItemSection';
import { HeaderIconButton } from '../../../../../src/navigation/HeaderIconButton';
import { useSession } from '../../../../../src/session';
import { useNetworkStore, useProjectStore } from '../../../../../src/state/stores';
import { Button, LoadingScreen, Notice, Screen, Text } from '../../../../../src/ui';

interface Section {
  key: string;
  item: ProjectWorkItem;
  data: ProjectTask[];
}

function openHistory(projectId: string) {
  router.push({ pathname: '/projects/[projectId]/history', params: { projectId } });
}

/**
 * Project detail (web `ProjectDetailPage`): summary with progress and dates, one section per active
 * chapter with its items to mark (haptic after each transaction), supplements and their voids, and
 * the progress history sheet. Every mutation is a transaction blocked offline with the BG-012 toast
 * (D4). Team assignments stay on the web until the Team tab (fase 2).
 */
export default function ProjectScreen() {
  const { projectId = '' } = useLocalSearchParams<{ projectId: string }>();
  const { uid } = useSession();
  const activeProject = useProjectStore((state) => state.activeProject);
  const online = useNetworkStore((state) => state.online);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const { busy, error: actionError, run } = useProjectMutation();
  const [loadResult, setLoadResult] = useState({ key: '', missing: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${uid ?? ''}:${projectId}`;
  const cached = uid
    ? getMemoryResource<ProjectDetail | null>(`private:${uid}:project:${projectId}`)
    : undefined;
  const project = activeProject?.id === projectId ? activeProject : (cached ?? null);
  const loading = Boolean(online && uid && projectId && loadResult.key !== requestKey && !project);
  const missing = loadResult.key === requestKey && loadResult.missing;
  const loadError = loadResult.key === requestKey ? loadResult.error : '';

  useEffect(() => {
    if (!uid || !projectId) return;
    let current = true;
    void useProjectStore
      .getState()
      .loadProject(uid, projectId)
      .then((result) => {
        if (current) setLoadResult({ key: requestKey, missing: !result, error: '' });
      })
      .catch((reason: unknown) => {
        if (current)
          setLoadResult({
            key: requestKey,
            missing: false,
            error: projectErrorMessage(
              reason,
              'No se ha podido cargar el proyecto. Vuelve a intentarlo.',
            ),
          });
      });
    return () => {
      current = false;
    };
  }, [uid, projectId, requestKey, attempt, dataRefreshVersion]);

  const sections = useMemo<Section[]>(
    () =>
      (project?.workItems ?? [])
        .filter((item) => !item.voidedAt)
        .map((item) => ({ key: item.id, item, data: item.tasks })),
    [project?.workItems],
  );

  if (loading)
    return (
      <>
        <Stack.Screen options={{ title: 'Proyecto' }} />
        <LoadingScreen message="Cargando proyecto…" />
      </>
    );

  if (!online && !project)
    return (
      <>
        <Stack.Screen options={{ title: 'Proyecto' }} />
        <LoadingScreen message="El contenido de este proyecto aún no está disponible en esta sesión. Conéctate a internet para abrirlo." />
      </>
    );

  if (loadError && !project)
    return (
      <>
        <Stack.Screen options={{ title: 'Proyecto' }} />
        <Screen edges={[]}>
          <Text variant="title" tone="strong">
            No se ha podido cargar el proyecto
          </Text>
          <Notice tone="danger" plain testID="project-load-error">
            {loadError}
          </Notice>
          <Button
            label="Reintentar"
            variant="secondary"
            onPress={() => {
              setLoadResult({ key: '', missing: false, error: '' });
              setAttempt((value) => value + 1);
            }}
          />
        </Screen>
      </>
    );

  if (missing || !project)
    return (
      <>
        <Stack.Screen options={{ title: 'Proyecto' }} />
        <Screen edges={[]}>
          <Text variant="title" tone="strong">
            Proyecto no disponible
          </Text>
          <Text tone="muted">No hemos encontrado este proyecto.</Text>
          <Button
            label="Volver a proyectos"
            variant="secondary"
            onPress={() => router.navigate('/projects')}
          />
        </Screen>
      </>
    );

  const store = useProjectStore.getState;
  const id = project.id;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text variant="display" tone="strong">
          {projectTitle(project)}
        </Text>
        <Text tone="muted">{`${project.clientName || 'Cliente sin nombre'}${project.address && project.address !== project.title ? ` · ${project.address}` : ''}`}</Text>
      </View>
      {!online ? (
        <Notice tone="warning" title="Sin conexión" icon="wifi-off" testID="project-offline-notice">
          Ves la última copia guardada. Para marcar partidas o guardar cambios, conéctate.
        </Notice>
      ) : null}
      {actionError || loadError ? (
        <Notice tone="danger" plain testID="project-action-error">
          {actionError || loadError}
        </Notice>
      ) : null}
      <ProjectSummaryCard
        project={project}
        busy={busy}
        onEstimatedEndDate={(date) =>
          void run('date:estimated-end', () => store().setEstimatedEndDate(id, date))
        }
      />
      <View style={styles.sectionTitle}>
        <Text variant="title" tone="strong">
          Capítulos de trabajo
        </Text>
        <Text variant="label" tone="muted" weight="regular">
          {`${sections.length} capítulos · ${project.totalConcepts} partidas. Marca cada partida cuando esté terminada.`}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Proyecto',
          headerRight: () => (
            <HeaderIconButton
              icon="trending-up"
              label="Ver progreso del proyecto"
              onPress={() => openHistory(id)}
            />
          ),
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={(task) => task.id}
        renderSectionHeader={({ section }) => (
          <WorkItemHeader
            item={section.item}
            mode={project.mode}
            busy={busy}
            onComplete={() =>
              void run(
                `work:${section.item.id}`,
                () => store().completeWorkItem(id, section.item.id),
                {
                  feedback: 'success',
                },
              )
            }
            onCompletionDate={(date) =>
              void run(`date:work:${section.item.id}`, () =>
                store().setWorkItemCompletionDate(id, section.item.id, date),
              )
            }
          />
        )}
        renderItem={({ item: task, section, index }) => (
          <TaskRow
            item={section.item}
            task={task}
            last={index === section.data.length - 1}
            busy={busy}
            onToggle={() =>
              void run(
                `${section.item.id}:${task.id}`,
                () => store().toggleTask(id, section.item.id, task.id),
                { feedback: task.completedAt ? 'selection' : 'success' },
              )
            }
            onCompletionDate={(date) =>
              void run(`date:task:${section.item.id}:${task.id}`, () =>
                store().setTaskCompletionDate(id, section.item.id, task.id, date),
              )
            }
          />
        )}
        ListHeaderComponent={header}
        ListFooterComponent={
          <View style={styles.footer}>
            <SupplementsCard project={project} busy={busy} />
          </View>
        }
        accessibilityLabel={projectSubtitle(project)}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.list}
        contentContainerStyle={styles.content}
        testID="project-detail"
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing[12] },
  header: { padding: spacing[4], paddingBottom: 0, gap: spacing[4] },
  titleBlock: { gap: spacing[1] },
  sectionTitle: { gap: spacing[1], marginTop: spacing[2] },
  footer: { padding: spacing[4], paddingTop: spacing[6] },
});

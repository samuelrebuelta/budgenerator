import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { reportNetworkUnavailable } from '@bg/app-core/network';
import type { ProjectDetail } from '@bg/domain/project/types';
import { colors, radii, spacing } from '@bg/ui-tokens';
import { useSession } from '../../session';
import { useNetworkStore, useWorkforceStore } from '../../state/stores';
import { Button, Card, Icon, Notice, Text, touchTarget } from '../../ui';
import { allowSavedMutation } from '../budgets/offline';
import { haptic, projectErrorMessage } from './mutations';
import { crewColor } from './team';

/**
 * «Equipo asignado» of the web detail (`ProjectTeamAssignments`): the people and crews assigned to
 * the project, as snapshots of names and members, with removal and the «Asignar equipo» sheet.
 * People and crews come from the shared workforce store; adding and removing are the shared
 * transactions, which bump `assignmentState.revision`. Offline they are blocked (BG-012 toast).
 */
export function TeamAssignmentsCard({
  project,
  busy,
  onRemove,
}: {
  project: ProjectDetail;
  busy: string | null;
  onRemove: (assignmentId: string) => void;
}) {
  const { uid } = useSession();
  const online = useNetworkStore((state) => state.online);
  const browserOnline = useNetworkStore((state) => state.browserOnline);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const loaded = useWorkforceStore((state) => state.loaded);
  const loadedUid = useWorkforceStore((state) => state.loadedUid);
  const [loadFailure, setLoadFailure] = useState<{ uid: string; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ready = Boolean(uid && loaded && loadedUid === uid);
  const loadError = loadFailure && loadFailure.uid === uid ? loadFailure.error : '';

  useEffect(() => {
    if (!uid) return;
    if (!browserOnline && !(loaded && loadedUid === uid)) return;
    let current = true;
    void useWorkforceStore
      .getState()
      .loadWorkforce(uid)
      .catch((error: unknown) => {
        reportNetworkUnavailable(error);
        if (current)
          setLoadFailure({
            uid,
            error: projectErrorMessage(error, 'No se ha podido cargar el equipo.'),
          });
      });
    return () => {
      current = false;
    };
  }, [uid, browserOnline, loaded, loadedUid, dataRefreshVersion, attempt]);

  const openAssign = () => {
    if (!allowSavedMutation()) {
      haptic('warning');
      return;
    }
    router.push({ pathname: '/projects/[projectId]/assign', params: { projectId: project.id } });
  };

  let body;
  if (loadError)
    body = (
      <View style={styles.state}>
        <Notice tone="danger" plain testID="team-load-error">
          {loadError}
        </Notice>
        <Button
          label="Reintentar"
          variant="ghost"
          onPress={() => {
            setLoadFailure(null);
            setAttempt((value) => value + 1);
          }}
        />
      </View>
    );
  else if (!ready)
    body = (
      <Text variant="label" tone="muted" weight="regular" accessibilityRole="text">
        {online
          ? 'Cargando personas y cuadrillas…'
          : 'El equipo aún no está disponible en esta sesión. Conéctate a internet para verlo.'}
      </Text>
    );
  else if (project.assignments.length === 0)
    body = (
      <Text variant="label" tone="muted" weight="regular" testID="team-empty">
        Todavía no hay personas ni cuadrillas asignadas a este proyecto.
      </Text>
    );
  else
    body = (
      <View style={styles.list} accessibilityLabel="Asignaciones del proyecto">
        {project.assignments.map((assignment) => {
          const tint = assignment.resourceType === 'crew' ? crewColor(assignment.color) : null;
          const count = assignment.members.length;
          return (
            <View
              key={assignment.id}
              style={[
                styles.assignment,
                tint ? { backgroundColor: tint.fill } : styles.memberAssignment,
              ]}
              testID={`assignment-${assignment.id}`}
            >
              <View style={styles.avatar}>
                <Icon
                  name={assignment.resourceType === 'crew' ? 'users' : 'user'}
                  size={15}
                  color={tint?.ink ?? colors.ink}
                />
              </View>
              <View style={styles.flex}>
                <Text weight="semibold" numberOfLines={1} style={tint && { color: tint.ink }}>
                  {assignment.label}
                </Text>
                <Text variant="caption" style={{ color: tint?.ink ?? colors['ink-muted'] }}>
                  {`${assignment.resourceType === 'crew' ? 'Cuadrilla' : 'Persona'} · ${count} ${count === 1 ? 'integrante' : 'integrantes'}`}
                </Text>
                <View
                  style={styles.chips}
                  accessibilityLabel={`Integrantes de ${assignment.label}`}
                >
                  {assignment.members.map((member) => (
                    <Text key={member.id} variant="caption" style={styles.chip}>
                      {member.name}
                    </Text>
                  ))}
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar asignación de ${assignment.label}`}
                accessibilityState={{ disabled: !!busy, busy: busy === assignment.id }}
                disabled={!!busy}
                onPress={() => onRemove(assignment.id)}
                hitSlop={6}
                style={styles.remove}
                testID={`assignment-remove-${assignment.id}`}
              >
                <Icon name="x" size={16} color={tint?.ink ?? colors.ink} />
              </Pressable>
            </View>
          );
        })}
      </View>
    );

  return (
    <Card style={styles.card} testID="project-team">
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="title" tone="strong">
            Equipo asignado
          </Text>
          <Text variant="caption" tone="muted">
            Las asignaciones guardan una instantánea de los nombres y la composición actuales.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Asignar equipo"
          icon="user-plus"
          variant="secondary"
          disabled={!ready || !!busy}
          onPress={openAssign}
          testID="project-team-assign"
        />
        <Button
          label="Gestionar equipo"
          variant="ghost"
          onPress={() => router.navigate('/team')}
          testID="project-team-manage"
        />
      </View>
      {body}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  flex: { flex: 1, gap: 2 },
  state: { gap: spacing[2], alignItems: 'flex-start' },
  list: { gap: spacing[2] },
  assignment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  memberAssignment: {
    backgroundColor: colors['surface-muted'],
    borderColor: colors['line-strong'],
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  chip: {
    overflow: 'hidden',
    borderRadius: radii.pill,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    color: colors.ink,
  },
  remove: {
    width: touchTarget,
    height: touchTarget,
    marginTop: -spacing[2],
    marginRight: -spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ProjectAssignment } from '@bg/domain/project/types';
import { colors, spacing } from '@bg/ui-tokens';
import { useProjectMutation } from '../../../../../src/features/projects/mutations';
import { assignmentOptions, crewColor } from '../../../../../src/features/projects/team';
import { useProjectStore, useWorkforceStore } from '../../../../../src/state/stores';
import { Button, Card, Notice, Text } from '../../../../../src/ui';

/**
 * «Asignar equipo» (web dialog of `ProjectTeamAssignments`) as a native sheet: active people and
 * active crews with at least one active member. The conflict rules of the web (a person already in
 * an assigned crew, a crew sharing people with another assignment) disable the option and explain
 * why; the shared `addAssignment` transaction checks them again against `assignmentState.revision`.
 */
export default function AssignTeamSheet() {
  const { projectId = '' } = useLocalSearchParams<{ projectId: string }>();
  const assignments = useProjectStore((state) =>
    state.activeProject?.id === projectId ? state.activeProject.assignments : undefined,
  );
  const members = useWorkforceStore((state) => state.members);
  const crews = useWorkforceStore((state) => state.crews);
  const { busy, error, run } = useProjectMutation();
  const options = assignmentOptions(members, crews, assignments ?? []);
  const empty = options.members.length === 0 && options.crews.length === 0;

  const assign = (resourceType: ProjectAssignment['resourceType'], resourceId: string) =>
    void run(
      `${resourceType}_${resourceId}`,
      async () => {
        await useProjectStore.getState().addAssignment(projectId, resourceType, resourceId);
        router.back();
      },
      { feedback: 'success', fallback: 'No se ha podido actualizar la asignación.' },
    );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      testID="assign-sheet"
    >
      <Text tone="muted">Elige una persona o una cuadrilla activa.</Text>
      {error ? (
        <Notice tone="danger" plain testID="assign-error">
          {error}
        </Notice>
      ) : null}
      {empty ? (
        <Card style={styles.card}>
          <Text tone="muted">No hay recursos activos disponibles.</Text>
          <Text variant="caption" tone="muted">
            Da de alta personas y cuadrillas en Equipo.
          </Text>
        </Card>
      ) : null}
      {options.members.length > 0 ? (
        <View style={styles.group}>
          <Text variant="label" weight="semibold" tone="strong" accessibilityRole="header">
            Personas
          </Text>
          <Card style={styles.list}>
            {options.members.map(({ member, assigned, inCrew }, index) => (
              <View
                key={member.id}
                style={[styles.row, index > 0 && styles.divider]}
                testID={`assign-member-${member.id}`}
              >
                <View style={styles.flex}>
                  <Text weight="medium">{member.name}</Text>
                  {!assigned && inCrew ? (
                    <Text variant="caption" tone="muted">{`Incluida en ${inCrew.label}`}</Text>
                  ) : null}
                </View>
                <Button
                  label={assigned ? 'Asignada' : inCrew ? 'En cuadrilla' : 'Asignar'}
                  variant="secondary"
                  accessibilityLabel={
                    !assigned && inCrew
                      ? `Incluida en ${inCrew.label}`
                      : `${assigned ? 'Asignada' : 'Asignar'} ${member.name}`
                  }
                  disabled={assigned || Boolean(inCrew) || !!busy}
                  loading={busy === `member_${member.id}`}
                  onPress={() => assign('member', member.id)}
                  testID={`assign-member-${member.id}-button`}
                />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
      {options.crews.length > 0 ? (
        <View style={styles.group}>
          <Text variant="label" weight="semibold" tone="strong" accessibilityRole="header">
            Cuadrillas
          </Text>
          <Card style={styles.list}>
            {options.crews.map(({ crew, assigned, activeCount, conflict }, index) => (
              <View
                key={crew.id}
                style={[styles.row, index > 0 && styles.divider]}
                testID={`assign-crew-${crew.id}`}
              >
                <View
                  style={[styles.dot, { backgroundColor: crewColor(crew.color).dot }]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <View style={styles.flex}>
                  <Text weight="medium">{crew.label}</Text>
                  <Text variant="caption" tone="muted">
                    {`${activeCount} ${activeCount === 1 ? 'integrante activo' : 'integrantes activos'}`}
                  </Text>
                  {conflict ? (
                    <Text
                      variant="caption"
                      style={styles.conflict}
                      testID={`assign-crew-${crew.id}-conflict`}
                    >
                      {conflict}
                    </Text>
                  ) : null}
                </View>
                <Button
                  label={assigned ? 'Asignada' : 'Asignar'}
                  variant="secondary"
                  accessibilityLabel={
                    conflict
                      ? `No disponible: ${conflict}`
                      : `${assigned ? 'Asignada' : 'Asignar'} ${crew.label}`
                  }
                  disabled={assigned || Boolean(conflict) || !!busy}
                  loading={busy === `crew_${crew.id}`}
                  onPress={() => assign('crew', crew.id)}
                  testID={`assign-crew-${crew.id}-button`}
                />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  card: { gap: spacing[1] },
  group: { gap: spacing[2] },
  list: { paddingVertical: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  flex: { flex: 1, gap: 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  conflict: { color: colors['warning-ink'] },
});

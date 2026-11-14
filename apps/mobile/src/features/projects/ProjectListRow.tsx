import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatEuros } from '@bg/domain';
import type { Project } from '@bg/domain/project/types';
import { colors, spacing } from '@bg/ui-tokens';
import { Icon, isAndroid, isIOS, systemColors, Text } from '../../ui';
import { formatProjectDate, projectSubtitle, STATUS_LABELS } from './model';
import { ProgressBar, ProjectStatusBadge } from './ProjectStatusBadge';

/**
 * Row of the projects list (web `ProjectsPage` card): client, status, title or address, percent,
 * progress bar, items done and the accepted date with the updated total (`updatedTotal` as stored
 * by the shared repository, formatted by `@bg/domain`).
 */
export const ProjectListRow = memo(function ProjectListRow({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (id: string) => void;
}) {
  const client = project.clientName || 'Cliente sin nombre';
  const subtitle = projectSubtitle(project);
  const total = formatEuros(project.updatedTotal ?? project.total);
  const accepted = formatProjectDate(project.acceptedAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${client}, ${subtitle}, ${STATUS_LABELS[project.status]}, ${project.percent} %, ${project.completedConcepts} de ${project.totalConcepts} partidas, total actualizado ${total}`}
      onPress={() => onOpen(project.id)}
      android_ripple={{ color: systemColors.ripple }}
      style={({ pressed }) => [styles.row, pressed && isIOS && styles.pressed]}
      testID={`project-row-${project.id}`}
    >
      <View style={styles.top}>
        <View style={styles.texts}>
          <Text weight="semibold" tone="strong" numberOfLines={1}>
            {client}
          </Text>
          <Text variant="label" tone="muted" weight="regular" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Text weight="semibold" tone="strong" style={styles.percent}>
          {`${project.percent}%`}
        </Text>
        {isIOS ? <Icon name="chevron-right" size={14} color={colors['ink-subtle']} /> : null}
      </View>
      <ProgressBar
        percent={project.percent}
        label={`Avance de ${project.title || project.clientName}: ${project.percent}%`}
      />
      <View style={styles.bottom}>
        <ProjectStatusBadge status={project.status} />
        <Text variant="caption" tone="muted" style={styles.meta} numberOfLines={2}>
          {`${project.completedConcepts} de ${project.totalConcepts} partidas · Aceptado el ${accepted} · Total actualizado ${total}`}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    gap: spacing[2.5],
    paddingHorizontal: spacing[4],
    paddingVertical: isAndroid ? spacing[4] : spacing[3.5],
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors['surface-muted'] },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  texts: { flex: 1, gap: 2 },
  percent: { fontVariant: ['tabular-nums'] },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  meta: { flex: 1 },
});

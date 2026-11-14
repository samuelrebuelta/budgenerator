import { StyleSheet, View } from 'react-native';
import type { ProjectStatus } from '@bg/domain/project/types';
import { colors, spacing } from '@bg/ui-tokens';
import { Icon, Text, type IconName } from '../../ui';
import { STATUS_LABELS } from './model';

const palette: Record<
  ProjectStatus,
  { surface: string; line: string; ink: string; icon: IconName }
> = {
  pending: {
    surface: colors.canvas,
    line: colors['line-strong'],
    ink: colors['ink-muted'],
    icon: 'circle',
  },
  in_progress: {
    surface: colors['accent-surface'],
    line: colors['accent-line'],
    ink: colors['accent-strong'],
    icon: 'tool',
  },
  completed: {
    surface: colors['success-surface'],
    line: colors['success-line'],
    ink: colors['success-ink'],
    icon: 'check-circle',
  },
};

/** Web `ProjectStatusTag`: pill with icon and label. */
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const style = palette[status];
  const label = STATUS_LABELS[status];
  return (
    <View
      accessible
      accessibilityLabel={`Estado: ${label}`}
      style={[styles.badge, { backgroundColor: style.surface, borderColor: style.line }]}
      testID={`project-status-${status}`}
    >
      <Icon name={style.icon} size={13} color={style.ink} />
      <Text variant="caption" weight="semibold" style={{ color: style.ink }}>
        {label}
      </Text>
    </View>
  );
}

/** Web `ProjectProgressBar`, exposed as a progress bar to VoiceOver/TalkBack. */
export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${value}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    minHeight: 26,
    paddingHorizontal: spacing[2],
    borderRadius: 999,
    borderWidth: 1,
  },
  track: {
    height: 8,
    borderRadius: 4,
    // `line` keeps the empty track visible on the chapter header (`surface-muted`) and the summary.
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
});

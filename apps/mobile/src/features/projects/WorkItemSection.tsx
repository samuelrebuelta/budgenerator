import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { formatEuros, formatQuantity, taskAmount, unitLabel } from '@bg/domain';
import { getProjectLocalDateKey } from '@bg/domain/project/history';
import { workItemProgress } from '@bg/domain/project/progress';
import type { ProjectProgressMode, ProjectTask, ProjectWorkItem } from '@bg/domain/project/types';
import { colors, spacing } from '@bg/ui-tokens';
import { Button, Icon, isAndroid, isIOS, systemColors, Text } from '../../ui';
import { DateField } from './DateField';
import { todayDateKey } from './model';
import { ProgressBar } from './ProjectStatusBadge';

function safeDateKey(value: string | undefined) {
  if (!value) return undefined;
  try {
    return getProjectLocalDateKey(value);
  } catch {
    return undefined;
  }
}

export interface WorkItemHeaderProps {
  item: ProjectWorkItem;
  mode: ProjectProgressMode;
  busy: string | null;
  onComplete: () => void;
  onCompletionDate: (dateKey: string) => void;
}

/**
 * Chapter of the project (web work item card): name, items done and percent from
 * `workItemProgress` of `@bg/domain`, its bar, «Completar capítulo» and, once complete, its
 * completion date with the native picker (never in the future).
 */
export function WorkItemHeader({
  item,
  mode,
  busy,
  onComplete,
  onCompletionDate,
}: WorkItemHeaderProps) {
  const progress = workItemProgress(item, mode);
  const allComplete =
    progress.totalConcepts > 0 && progress.completedConcepts === progress.totalConcepts;
  const completedAt = allComplete ? safeDateKey(item.tasks[0]?.completedAt) : undefined;
  return (
    <View style={styles.header} testID={`work-item-${item.id}`}>
      <View style={styles.headerTop}>
        <View style={styles.flex}>
          <Text variant="label" weight="semibold" tone="strong" numberOfLines={2}>
            {item.name}
          </Text>
          <Text variant="caption" tone="muted" testID={`work-item-progress-${item.id}`}>
            {`${progress.completedConcepts} de ${progress.totalConcepts} partidas · ${progress.percent}%`}
          </Text>
        </View>
        <Button
          label={allComplete ? 'Completado' : 'Completar capítulo'}
          icon={allComplete ? 'check-circle' : 'clipboard'}
          variant={allComplete ? 'ghost' : 'secondary'}
          disabled={allComplete || !!busy}
          loading={busy === `work:${item.id}`}
          accessibilityLabel={
            allComplete ? `Capítulo ${item.name} completado` : `Completar capítulo ${item.name}`
          }
          onPress={onComplete}
          testID={`work-item-complete-${item.id}`}
        />
      </View>
      <ProgressBar
        percent={progress.percent}
        label={`Avance del capítulo ${item.name}: ${progress.percent}%`}
      />
      {completedAt ? (
        <DateField
          compact
          value={completedAt}
          maximumDate={todayDateKey()}
          label={`Cambiar fecha de finalización: el capítulo ${item.name}`}
          disabled={!!busy}
          loading={busy === `date:work:${item.id}`}
          onChange={onCompletionDate}
          testID={`work-item-date-${item.id}`}
        />
      ) : null}
    </View>
  );
}

export interface TaskRowProps {
  item: ProjectWorkItem;
  task: ProjectTask;
  last: boolean;
  busy: string | null;
  onToggle: () => void;
  onCompletionDate: (dateKey: string) => void;
}

/**
 * Item of a chapter: a checkbox row (Reminders style on iOS, M3 list item with a checkbox on
 * Android) with the quantity and the amount from `taskAmount`, and the completion date chip once
 * it is done. The whole row toggles; the haptic comes after the transaction succeeds.
 */
export function TaskRow({ item, task, last, busy, onToggle, onCompletionDate }: TaskRowProps) {
  const key = `${item.id}:${task.id}`;
  const completed = !!task.completedAt;
  const completedAt = safeDateKey(task.completedAt);
  const loading = busy === key;
  const amount = formatEuros(taskAmount(task));
  return (
    <View style={[styles.task, last && styles.taskLast]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={task.description || 'Partida sin descripción'}
        accessibilityHint={completed ? 'Reabre la partida' : 'Marca la partida como terminada'}
        accessibilityState={{ checked: completed, disabled: !!busy, busy: loading }}
        disabled={!!busy}
        onPress={onToggle}
        android_ripple={{ color: systemColors.ripple }}
        style={({ pressed }) => [styles.taskPress, pressed && isIOS && styles.pressed]}
        testID={`project-task-${task.id}`}
      >
        <View style={[styles.check, completed && styles.checkOn]}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={completed ? colors['on-primary'] : colors.primary}
            />
          ) : completed ? (
            <Icon name="check" size={14} color={colors['on-primary']} />
          ) : null}
        </View>
        <View style={styles.flex}>
          <Text tone={completed ? 'muted' : 'default'} style={completed && styles.done}>
            {task.description || 'Partida sin descripción'}
          </Text>
          <Text variant="caption" tone="muted" style={styles.tabular}>
            {`${formatQuantity(task.quantity)} ${unitLabel(task.unit)} · ${amount}`}
          </Text>
        </View>
      </Pressable>
      {completed && completedAt ? (
        <View style={styles.taskDate}>
          <DateField
            compact
            value={completedAt}
            maximumDate={todayDateKey()}
            label={`Cambiar fecha de finalización: la partida ${task.description}`}
            disabled={!!busy}
            loading={busy === `date:task:${key}`}
            onChange={onCompletionDate}
            testID={`project-task-date-${task.id}`}
          />
        </View>
      ) : null}
    </View>
  );
}

const radius = isAndroid ? 12 : 16;

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  header: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[4],
    gap: spacing[2.5],
    backgroundColor: colors['surface-muted'],
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderCurve: 'continuous',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  task: {
    marginHorizontal: spacing[4],
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  taskLast: { borderBottomLeftRadius: radius, borderBottomRightRadius: radius, overflow: 'hidden' },
  taskPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: isAndroid ? 72 : 56,
  },
  pressed: { backgroundColor: colors['surface-muted'] },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors['line-strong'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  done: { textDecorationLine: 'line-through' },
  tabular: { fontVariant: ['tabular-nums'] },
  taskDate: { paddingLeft: spacing[4] + 26 + spacing[3], paddingBottom: spacing[3] },
});

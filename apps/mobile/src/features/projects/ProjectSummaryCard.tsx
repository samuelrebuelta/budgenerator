import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { formatEuros } from '@bg/domain';
import type { ProjectDetail } from '@bg/domain/project/types';
import { colors, spacing } from '@bg/ui-tokens';
import { Button, Card, Text } from '../../ui';
import { DateField } from './DateField';
import { activeSupplementsTotal, formatProjectDate } from './model';
import { ProgressBar, ProjectStatusBadge } from './ProjectStatusBadge';

export interface ProjectSummaryCardProps {
  project: ProjectDetail;
  busy: string | null;
  onEstimatedEndDate: (dateKey: string) => void;
}

/**
 * «Avance estimado» of the web detail: percent, status and progress bar, how it is weighted, the
 * project dates (accepted and created are fixed; the estimated end date is editable with the native
 * picker) and the accepted, supplements and updated totals stored by the shared repository.
 */
export function ProjectSummaryCard({ project, busy, onEstimatedEndDate }: ProjectSummaryCardProps) {
  const supplementsTotal = activeSupplementsTotal(project);
  return (
    <Card style={styles.card} testID="project-summary">
      <View style={styles.top}>
        <View style={styles.texts}>
          <Text variant="title" tone="strong">
            Avance estimado
          </Text>
          <Text variant="label" tone="muted" weight="regular" testID="project-concepts">
            {`${project.completedConcepts} de ${project.totalConcepts} partidas terminadas`}
          </Text>
        </View>
        <Text variant="display" tone="strong" style={styles.percent} testID="project-percent">
          {`${project.percent}%`}
        </Text>
      </View>
      <ProgressBar percent={project.percent} label={`Avance del proyecto: ${project.percent}%`} />
      <View style={styles.row}>
        <ProjectStatusBadge status={project.status} />
        <Button
          label="Ver progreso"
          icon="trending-up"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: '/projects/[projectId]/history',
              params: { projectId: project.id },
            })
          }
          testID="project-history-button"
        />
      </View>
      <Text variant="caption" tone="muted">
        {project.mode === 'amount'
          ? `Ponderado por el importe neto previsto: ${formatEuros(project.completedAmount)} de ${formatEuros(project.totalAmount)}. No incluye IVA ni ajuste global.`
          : 'Calculado por partidas porque no todos los importes permiten una ponderación fiable.'}
      </Text>

      <View style={styles.divider} />
      <View style={styles.facts}>
        <Text variant="label" tone="muted" weight="regular">
          {`Aceptado el ${formatProjectDate(project.acceptedAt)}`}
        </Text>
        <Text variant="label" tone="muted" weight="regular">
          {`Proyecto creado el ${formatProjectDate(project.createdAt)}`}
        </Text>
        <Text variant="label" tone="muted" weight="regular">
          {`Presupuesto ${project.sourceBudgetNumber}`}
        </Text>
      </View>
      <View style={styles.dateBlock}>
        <Text variant="label" weight="medium">
          Fecha estimada de fin del proyecto
        </Text>
        <DateField
          value={project.estimatedEndDate}
          label="Fecha estimada de fin del proyecto"
          disabled={!!busy}
          loading={busy === 'date:estimated-end'}
          onChange={onEstimatedEndDate}
          testID="project-estimated-end"
        />
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {busy === 'date:estimated-end'
            ? 'Guardando fecha…'
            : 'Se guarda al cambiarla. En Equipo se mostrará el proyecto hasta esa fecha.'}
        </Text>
      </View>

      <View style={styles.divider} />
      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text variant="label" tone="muted" weight="regular" style={styles.flex}>
            Total aceptado · IVA incluido
          </Text>
          <Text weight="semibold" style={styles.tabular}>
            {formatEuros(project.total)}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <View style={styles.flex}>
            <Text variant="label" tone="muted" weight="regular">
              Suplementos activos · IVA incluido
            </Text>
            <Text variant="caption" tone="muted">
              {`Neto ${formatEuros(project.supplementsSubtotal ?? 0)} · IVA ${formatEuros(project.supplementsIva ?? 0)}`}
            </Text>
          </View>
          <Text weight="semibold" style={styles.tabular} testID="project-supplements-total">
            {formatEuros(supplementsTotal)}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text weight="semibold" tone="strong" style={styles.flex}>
            Total actualizado
          </Text>
          <Text variant="title" tone="strong" style={styles.tabular} testID="project-updated-total">
            {formatEuros(project.updatedTotal ?? project.total)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3], backgroundColor: colors['brand-50'] },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  texts: { flex: 1, gap: spacing[1] },
  percent: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors['line-strong'] },
  facts: { gap: spacing[1] },
  dateBlock: { gap: spacing[2] },
  totals: { gap: spacing[3] },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
});

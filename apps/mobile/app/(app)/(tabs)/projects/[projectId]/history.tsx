import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { calculateProjectProgressHistory } from '@bg/domain/project/history';
import { colors, spacing } from '@bg/ui-tokens';
import { activeConceptCount, formatProjectDate } from '../../../../../src/features/projects/model';
import { useProjectStore } from '../../../../../src/state/stores';
import { Card, Text } from '../../../../../src/ui';

const CHART_HEIGHT = 160;

/**
 * «Evolución del proyecto» (web `ProjectProgressHistoryDialog`) as a native sheet: cumulative
 * progress per completion date from `calculateProjectProgressHistory` of `@bg/domain`, drawn as
 * bars (no SVG module in the app) and listed day by day.
 */
export default function ProjectHistorySheet() {
  const { projectId = '' } = useLocalSearchParams<{ projectId: string }>();
  const project = useProjectStore((state) =>
    state.activeProject?.id === projectId ? state.activeProject : null,
  );
  const points = useMemo(
    () => (project ? calculateProjectProgressHistory(project.workItems, project.mode) : []),
    [project],
  );

  if (!project)
    return (
      <View style={styles.screen}>
        <Text tone="muted" style={styles.empty}>
          Abre el proyecto para ver su evolución.
        </Text>
      </View>
    );

  const total = activeConceptCount(project);
  const latest = points.at(-1);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      testID="project-history"
    >
      <Text tone="muted">Avance acumulado según la fecha registrada en cada partida.</Text>
      {points.length === 0 || !latest ? (
        <Card style={styles.emptyCard} testID="project-history-empty">
          <Text weight="semibold" style={styles.primary}>
            Aún no hay partidas terminadas
          </Text>
          <Text variant="label" tone="muted" weight="regular">
            La evolución aparecerá cuando registres el primer trabajo.
          </Text>
        </Card>
      ) : (
        <>
          <Card
            style={styles.chartCard}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Avance acumulado del proyecto por fecha. ${points.length} ${points.length === 1 ? 'fecha registrada' : 'fechas registradas'}. El avance más reciente es ${latest.percent}%.`}
          >
            <View style={styles.chart}>
              <View style={styles.axis}>
                {[100, 50, 0].map((tick) => (
                  <Text key={tick} variant="caption" tone="muted">
                    {`${tick}%`}
                  </Text>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.bars}>
                  {points.map((point) => (
                    <View key={point.date} style={styles.barSlot}>
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(4, (point.percent / 100) * CHART_HEIGHT) },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.range}>
              <Text variant="caption" tone="muted">
                {formatProjectDate(points[0]!.date)}
              </Text>
              {points.length > 1 ? (
                <Text variant="caption" tone="muted">
                  {formatProjectDate(latest.date)}
                </Text>
              ) : null}
            </View>
          </Card>

          <Card style={styles.table} accessibilityLabel="Detalle diario del avance acumulado">
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text variant="caption" weight="semibold" tone="muted" style={styles.colDate}>
                Fecha
              </Text>
              <Text variant="caption" weight="semibold" tone="muted" style={styles.col}>
                Avance
              </Text>
              <Text variant="caption" weight="semibold" tone="muted" style={styles.col}>
                Partidas
              </Text>
            </View>
            {points.map((point) => (
              <View
                key={point.date}
                style={styles.tableRow}
                accessible
                accessibilityLabel={`${formatProjectDate(point.date)}: ${point.percent}%, ${point.completedConcepts} de ${total} partidas`}
                testID={`project-history-${point.date}`}
              >
                <Text variant="label" weight="medium" style={styles.colDate}>
                  {formatProjectDate(point.date)}
                </Text>
                <Text variant="label" style={[styles.col, styles.primary, styles.tabular]}>
                  {`${point.percent}%`}
                </Text>
                <Text variant="label" tone="muted" style={[styles.col, styles.tabular]}>
                  {`${point.completedConcepts} de ${total}`}
                </Text>
              </View>
            ))}
          </Card>
          <Text variant="caption" tone="muted">
            {project.mode === 'amount'
              ? 'La gráfica pondera cada partida por su importe neto.'
              : 'La gráfica pondera cada partida por igual.'}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  empty: { padding: spacing[6], textAlign: 'center' },
  emptyCard: { alignItems: 'center', gap: spacing[1], paddingVertical: spacing[8] },
  primary: { color: colors.primary },
  chartCard: { gap: spacing[2] },
  chart: { flexDirection: 'row', height: CHART_HEIGHT, gap: spacing[2] },
  axis: { justifyContent: 'space-between', width: 36 },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  barSlot: { width: 22, height: CHART_HEIGHT, justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: colors['brand-500'],
  },
  range: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 44 },
  table: { padding: 0, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  tableHead: { backgroundColor: colors.canvas, borderTopWidth: 0 },
  colDate: { flex: 1.6 },
  col: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
});

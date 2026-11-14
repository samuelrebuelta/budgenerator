import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { formatEuros, formatQuantity, unitLabel } from '@bg/domain';
import type { ProjectDetail } from '@bg/domain/project/types';
import { colors, spacing } from '@bg/ui-tokens';
import { Button, Card, Text } from '../../ui';
import { formatProjectDate } from './model';

/**
 * «Ampliaciones» of the web detail: the unforeseen work registered on the project with its amount
 * and VAT (as stored by the transaction), the voided ones with date and reason, and the native
 * sheets to add one or void it.
 */
export function SupplementsCard({
  project,
  busy,
}: {
  project: ProjectDetail;
  busy: string | null;
}) {
  const count = project.supplements.length;
  return (
    <Card style={styles.card} testID="project-supplements">
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="title" tone="strong">
            Ampliaciones
          </Text>
          <Text variant="label" tone="muted" weight="regular">
            {count === 1 ? '1 ampliación registrada' : `${count} ampliaciones registradas`}
          </Text>
        </View>
        <Button
          label="Nueva"
          icon="plus"
          variant="secondary"
          disabled={!!busy}
          accessibilityLabel="Nueva ampliación"
          onPress={() =>
            router.push({
              pathname: '/projects/[projectId]/supplement',
              params: { projectId: project.id },
            })
          }
          testID="project-supplement-add"
        />
      </View>
      <Text variant="caption" tone="muted">
        Añade aquí trabajos imprevistos. El presupuesto aceptado se conserva como referencia y cada
        ampliación queda registrada con su importe e IVA.
      </Text>
      {count === 0 ? (
        <Text variant="label" tone="muted" weight="regular">
          Todavía no hay ampliaciones registradas.
        </Text>
      ) : (
        <View accessibilityLabel="Historial de ampliaciones">
          {project.supplements.map((supplement, index) => {
            const voided = project.supplementVoids.find(
              (entry) => entry.supplementId === supplement.id,
            );
            return (
              <View
                key={supplement.id}
                style={[styles.entry, index > 0 && styles.divider]}
                testID={`supplement-${supplement.id}`}
              >
                <View style={styles.entryTop}>
                  <View style={styles.flex}>
                    <Text weight="semibold" style={voided && styles.voided}>
                      {supplement.description}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {`${formatQuantity(supplement.quantity)} ${unitLabel(supplement.unit)} × ${formatEuros(supplement.unitPrice)} · Añadido el ${formatProjectDate(supplement.createdAt)}`}
                    </Text>
                  </View>
                  <Text weight="semibold" tone="strong" style={styles.tabular}>
                    {formatEuros(supplement.total)}
                  </Text>
                </View>
                {voided ? (
                  <Text
                    variant="caption"
                    tone="danger"
                    testID={`supplement-voided-${supplement.id}`}
                  >
                    {`Anulado el ${formatProjectDate(voided.voidedAt)} · ${voided.reason}`}
                  </Text>
                ) : (
                  <Button
                    label="Anular ampliación"
                    icon="slash"
                    variant="ghost"
                    disabled={!!busy}
                    accessibilityLabel={`Anular ampliación ${supplement.description}`}
                    onPress={() =>
                      router.push({
                        pathname: '/projects/[projectId]/void',
                        params: { projectId: project.id, supplementId: supplement.id },
                      })
                    }
                    testID={`supplement-void-${supplement.id}`}
                    style={styles.voidButton}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1, gap: 2 },
  entry: { gap: spacing[2], paddingVertical: spacing[3] },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  entryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  voided: { textDecorationLine: 'line-through', color: colors['ink-muted'] },
  tabular: { fontVariant: ['tabular-nums'] },
  voidButton: { alignSelf: 'flex-start' },
});

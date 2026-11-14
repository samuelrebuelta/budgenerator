import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { decimal, formatEuros, unitLabel, unitPrice, KNOWN_UNITS } from '@bg/domain';
import { catalogView } from '@bg/domain/catalog/record';
import { searchTariffs } from '@bg/domain/catalog/search';
import { t } from '@bg/domain/i18n';
import { colors, spacing } from '@bg/ui-tokens';
import {
  DRAFT_ID,
  isReadOnly,
  runEdit,
  useActiveBudget,
  useEditorRecord,
} from '../../../../../src/features/budgets/editing';
import { itemAmount, multiplierOf } from '../../../../../src/features/budgets/model';
import { HeaderIconButton } from '../../../../../src/navigation/HeaderIconButton';
import { useBudgetStore, useCatalogStore } from '../../../../../src/state/stores';
import {
  Button,
  Card,
  ListGroup,
  ListRow,
  systemColors,
  Text,
  TextField,
} from '../../../../../src/ui';

/** Text of a number field: what the user typed, or the stored value when it changed elsewhere. */
function useNumberText(value: number) {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    if (decimal(text) !== value) setText(value ? String(value).replace('.', ',') : '');
  }
  return [text, setText] as const;
}

function UnitPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (unit: string) => void;
  disabled: boolean;
}) {
  const units: string[] = KNOWN_UNITS.includes(value as (typeof KNOWN_UNITS)[number])
    ? [...KNOWN_UNITS]
    : [...KNOWN_UNITS, value];
  return (
    <View style={styles.field}>
      <Text variant="label" weight="medium" style={styles.label}>
        Unidad
      </Text>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {units.map((unit) => {
          const selected = unit === value;
          return (
            <Pressable
              key={unit}
              accessibilityRole="radio"
              accessibilityLabel={unitLabel(unit)}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(unit)}
              android_ripple={{ color: systemColors.ripple }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text
                variant="label"
                weight={selected ? 'semibold' : 'regular'}
                style={selected ? styles.segmentTextSelected : null}
              >
                {unitLabel(unit)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Item sheet (one row of the web's `EditableRow`): description, quantity and price with the decimal
 * keyboard and the «anterior / siguiente / hecho» toolbar, unit, the amount from `@bg/domain` and
 * the chapter's catalog prices (web `CatalogSelector`). Measured quantities and composed prices are
 * read-only, as on the web; their lines are edited on the web for now.
 */
export default function ItemSheet() {
  const {
    budgetId = DRAFT_ID,
    chapterId = '',
    itemId = '',
  } = useLocalSearchParams<{
    budgetId: string;
    chapterId: string;
    itemId: string;
  }>();
  const isDraft = budgetId === DRAFT_ID;
  const record = useEditorRecord(budgetId);
  const budget = useActiveBudget();
  const catalogRecord = useCatalogStore((state) => state.record);
  const updateTask = useBudgetStore((state) => state.updateTask);
  const removeTask = useBudgetStore((state) => state.removeTask);
  const applyCatalogConcept = useBudgetStore((state) => state.applyCatalogConcept);
  const chapter = budget?.workItems.find((item) => item.id === chapterId);
  const task = chapter?.tasks.find((item) => item.id === itemId);
  const [quantity, setQuantity] = useNumberText(task?.quantity ?? 0);
  const [price, setPrice] = useNumberText(task?.price ?? 0);
  const [query, setQuery] = useState('');
  const readOnly = isReadOnly(record);
  const catalog = useMemo(
    () => (catalogRecord ? catalogView(catalogRecord) : null),
    [catalogRecord],
  );
  const partId =
    chapter?.catalogPartId ?? catalog?.parts.find((part) => part.name === chapter?.name)?.id;
  const tariffs = useMemo(
    () => (catalog && partId ? catalog.tariffs.filter((tariff) => tariff.partId === partId) : []),
    [catalog, partId],
  );
  const results = useMemo(() => searchTariffs(tariffs, query).slice(0, 30), [tariffs, query]);

  if (!budget || !chapter || !task)
    return (
      <View style={styles.missing}>
        <Text tone="muted">Esta partida ya no existe.</Text>
        <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />
      </View>
    );

  const update = (patch: Parameters<typeof updateTask>[2]) =>
    runEdit(isDraft, () => updateTask(chapter.id, task.id, patch));
  const multiplier = multiplierOf(budget);

  const remove = () =>
    Alert.alert('¿Eliminar partida?', 'Se quitará esta partida del presupuesto.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          if (runEdit(isDraft, () => (removeTask(chapter.id, task.id), true))) router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: readOnly ? 'Partida' : 'Editar partida',
          headerRight: () => (
            <HeaderIconButton
              icon="check"
              label="Hecho"
              onPress={() => router.back()}
              testID="item-done"
            />
          ),
        }}
      />
      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={64}
        testID="item-sheet"
      >
        <Card style={styles.card}>
          <TextField
            label={t('common.description')}
            value={task.description}
            placeholder={t('common.description')}
            multiline
            autoCapitalize="sentences"
            autoCorrect
            editable={!readOnly}
            onChangeText={(description) => update({ description })}
            testID="item-description"
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                label="Cantidad"
                value={quantity}
                placeholder="0"
                keyboardType="decimal-pad"
                editable={!readOnly && !task.measured}
                hint={task.measured ? 'Calculada con las líneas de medición' : undefined}
                onChangeText={(text) => {
                  setQuantity(text);
                  update({ quantity: decimal(text) });
                }}
                testID="item-quantity"
              />
            </View>
            <View style={styles.half}>
              <TextField
                label={multiplier > 1 ? 'Precio base (€)' : 'Precio (€)'}
                value={price}
                placeholder="0"
                keyboardType="decimal-pad"
                editable={!readOnly && !task.composed}
                hint={task.composed ? 'Calculado con la descomposición del precio' : undefined}
                onChangeText={(text) => {
                  setPrice(text);
                  update({ price: decimal(text) });
                }}
                testID="item-price"
              />
            </View>
          </View>
          <UnitPicker value={task.unit} disabled={readOnly} onChange={(unit) => update({ unit })} />
          <View
            style={styles.amountRow}
            accessible
            accessibilityLabel={`${t('editor.amount')} ${formatEuros(itemAmount(budget, task))}`}
          >
            <Text variant="label" tone="muted">
              {t('editor.amount')}
              {multiplier > 1
                ? ` · ${formatEuros(unitPrice(task, multiplier))}/${unitLabel(task.unit)} con recargo`
                : ''}
            </Text>
            <Text variant="title" tone="strong" style={styles.tabular} testID="item-amount">
              {formatEuros(itemAmount(budget, task))}
            </Text>
          </View>
        </Card>

        {!readOnly && tariffs.length ? (
          <View style={styles.block}>
            <Text variant="label" weight="semibold" tone="muted">
              Aplicar tarifa del catálogo · {chapter.name}
            </Text>
            <TextField
              label="Buscar partidas del capítulo"
              hideLabel
              value={query}
              placeholder="Buscar partida"
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {results.length ? (
              <ListGroup>
                {results.map((tariff) => (
                  <ListRow
                    key={tariff.id}
                    title={tariff.description}
                    subtitle={`${formatEuros(tariff.basePrice)}/${unitLabel(tariff.unit)}`}
                    onPress={() => {
                      const content = useCatalogStore.getState().record?.document;
                      if (content)
                        runEdit(isDraft, () =>
                          applyCatalogConcept(task.id, content, tariff.id, tariff.partId),
                        );
                    }}
                  />
                ))}
              </ListGroup>
            ) : (
              <Text variant="label" tone="muted">
                No hay coincidencias en este capítulo. Prueba otra descripción.
              </Text>
            )}
          </View>
        ) : null}

        {!readOnly ? (
          <Button
            label="Eliminar partida"
            icon="trash-2"
            variant="danger"
            onPress={remove}
            testID="item-delete"
          />
        ) : null}
      </KeyboardAwareScrollView>
      <KeyboardToolbar>
        <KeyboardToolbar.Prev />
        <KeyboardToolbar.Next />
        <KeyboardToolbar.Done text="Hecho" />
      </KeyboardToolbar>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  card: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[3] },
  half: { flex: 1 },
  field: { gap: spacing[1] },
  label: { color: colors['ink-soft'] },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  segment: {
    minWidth: 56,
    minHeight: 40,
    paddingHorizontal: spacing[3],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors['line-strong'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentSelected: {
    backgroundColor: systemColors.secondaryContainer,
    borderColor: colors.primary,
  },
  segmentTextSelected: { color: colors['ink-strong'] },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  tabular: { fontVariant: ['tabular-nums'] },
  block: { gap: spacing[2] },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    padding: spacing[6],
  },
});

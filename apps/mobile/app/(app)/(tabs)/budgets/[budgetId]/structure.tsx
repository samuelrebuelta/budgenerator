import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { sessionRevision } from '@bg/app-core/session';
import { decimal, formatEuros, formatQuantity, unitLabel } from '@bg/domain';
import { budgetView } from '@bg/domain/budget/record';
import { conceptKey, structureFromSelection } from '@bg/domain/budget-structure/model';
import { catalogView } from '@bg/domain/catalog/record';
import { compareSpanish, searchCatalogParts } from '@bg/domain/catalog/search';
import type { Budget, CatalogPart } from '@bg/domain/types';
import { colors, spacing } from '@bg/ui-tokens';
import { activeRecord } from '@bg/app-core/stores/budget';
import { useBudgetStore, useCatalogStore } from '../../../../../src/state/stores';
import { Button, Card, Checkbox, ListGroup, Notice, Text, TextField } from '../../../../../src/ui';

interface Snapshot {
  budget: Budget;
  parts: CatalogPart[];
  revision: number;
}

/** Budget view and catalog chapters when the flow opened; a change makes the selection stale. */
function useSnapshot(): Snapshot | null {
  const [snapshot] = useState<Snapshot | null>(() => {
    const record = activeRecord(useBudgetStore.getState());
    const catalog = useCatalogStore.getState().record;
    if (!record) return null;
    return {
      budget: budgetView(record),
      parts: catalog ? catalogView(catalog).parts : [],
      revision: sessionRevision(),
    };
  });
  return snapshot;
}

/**
 * Guided creation from the catalog (web `BudgetStructureButton`): chapters → items of each chapter
 * with an optional quantity → review and order → the structure is appended with
 * `structureFromSelection` and `appendStructure` of the shared domain and store.
 */
export default function StructureSheet() {
  const snapshot = useSnapshot();
  const [step, setStep] = useState(0);
  const [partIds, setPartIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const currentRecord = useBudgetStore((state) => activeRecord(state));
  const currentCatalog = useCatalogStore((state) => state.record);
  const parts = useMemo(() => snapshot?.parts ?? [], [snapshot]);
  const stale =
    !snapshot ||
    !currentRecord ||
    budgetView(currentRecord) !== snapshot.budget ||
    (currentCatalog ? catalogView(currentCatalog).parts : []) !== snapshot.parts ||
    sessionRevision() !== snapshot.revision;
  const selectable = useMemo(() => parts.filter((part) => part.concepts.length > 0), [parts]);
  const reviewStep = partIds.length + 1;
  const review = step === reviewStep;
  const currentPart =
    step > 0 && !review ? parts.find((part) => part.id === partIds[step - 1]) : undefined;
  const visible = useMemo(
    () => (currentPart ? (searchCatalogParts([currentPart], query)[0]?.concepts ?? []) : []),
    [currentPart, query],
  );
  const picked = partIds.flatMap((partId) => {
    const part = parts.find((item) => item.id === partId);
    return (
      part?.concepts
        .filter((concept) => selected.includes(conceptKey(partId, concept.id)))
        .map((concept) => ({ partId, concept })) ?? []
    );
  });
  const ordered = partIds.filter((id) => picked.some((item) => item.partId === id));
  const stepTitle =
    step === 0 ? 'Capítulos' : review ? 'Revisión' : (currentPart?.name ?? 'Partidas');
  const heading =
    step === 0
      ? '¿Qué capítulos vas a incluir?'
      : review
        ? 'Revisa la estructura'
        : `Elige partidas de ${currentPart?.name ?? 'este capítulo'}`;

  const togglePart = (partId: string) =>
    setPartIds((old) =>
      old.includes(partId) ? old.filter((id) => id !== partId) : [...old, partId],
    );
  const toggleConcept = (partId: string, conceptId: string) => {
    const key = conceptKey(partId, conceptId);
    if (selected.includes(key)) {
      setSelected((old) => old.filter((value) => value !== key));
      setQuantities((old) => {
        const next = { ...old };
        delete next[key];
        return next;
      });
    } else setSelected((old) => [...old, key]);
  };
  const move = (partId: string, delta: number) =>
    setPartIds((old) => {
      const next = [...old];
      const index = next.indexOf(partId);
      const target = ordered[ordered.indexOf(partId) + delta];
      const other = target ? next.indexOf(target) : -1;
      if (other >= 0) [next[index], next[other]] = [next[other]!, next[index]!];
      return next;
    });
  const go = (delta: number) => {
    setQuery('');
    setError('');
    setStep((old) => old + delta);
  };
  const confirm = () => {
    if (stale || !snapshot) return;
    try {
      const keys = picked
        .filter((item) => ordered.includes(item.partId))
        .map((item) => conceptKey(item.partId, item.concept.id));
      const chapters = structureFromSelection(
        snapshot.parts,
        ordered,
        keys,
        Object.fromEntries(keys.map((key) => [key, decimal(quantities[key] ?? '')])),
      );
      useBudgetStore
        .getState()
        .appendStructure(chapters, snapshot.budget, useCatalogStore.getState().record?.document);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido añadir la estructura.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Crear paso a paso' }} />
      <KeyboardAwareScrollView
        // A new step starts at the top (its own scroll view).
        key={step}
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={96}
        testID="structure-sheet"
      >
        <View style={styles.intro}>
          <Text variant="caption" weight="semibold" tone="muted" accessibilityRole="text">
            Paso {step + 1} de {partIds.length + 2} · {stepTitle}
          </Text>
          <Text variant="title" tone="strong">
            {heading}
          </Text>
          <Text variant="label" tone="muted" weight="regular">
            {step === 0
              ? 'Empieza por los capítulos de la reforma. Después revisarás sus partidas por separado.'
              : review
                ? 'Ordena los capítulos y comprueba las cantidades antes de pasar al editor.'
                : 'Elige las partidas que necesitas. Puedes indicar una cantidad ahora o completarla después.'}
          </Text>
        </View>
        {stale ? (
          <Notice tone="danger" plain>
            El presupuesto o el catálogo ha cambiado. Cierra el asistente y vuelve a abrirlo para
            revisar la selección.
          </Notice>
        ) : null}
        {error ? (
          <Notice tone="danger" plain>
            {error}
          </Notice>
        ) : null}

        {step === 0 ? (
          selectable.length ? (
            <Card style={styles.list}>
              {selectable.map((part) => (
                <Checkbox
                  key={part.id}
                  checked={partIds.includes(part.id)}
                  onChange={() => togglePart(part.id)}
                  accessibilityLabel={part.name}
                >
                  <Text weight="medium">{part.name}</Text>
                  <Text variant="caption" tone="muted">
                    {part.concepts.length} {part.concepts.length === 1 ? 'partida' : 'partidas'}
                  </Text>
                </Checkbox>
              ))}
            </Card>
          ) : (
            <Text tone="muted">Tu catálogo no tiene partidas todavía.</Text>
          )
        ) : null}

        {currentPart ? (
          <>
            <TextField
              label="Buscar partidas"
              hideLabel
              value={query}
              placeholder={`Buscar en ${currentPart.name}`}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            <Card style={styles.list}>
              {visible.map((concept) => {
                const key = conceptKey(currentPart.id, concept.id);
                const isSelected = selected.includes(key);
                return (
                  <View key={key} style={styles.concept}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleConcept(currentPart.id, concept.id)}
                      accessibilityLabel={concept.description}
                    >
                      <Text>{concept.description}</Text>
                      <Text variant="caption" tone="muted">
                        {formatEuros(concept.basePrice)}/{unitLabel(concept.unit)}
                      </Text>
                    </Checkbox>
                    {isSelected ? (
                      <View style={styles.quantity}>
                        <TextField
                          label={`Cantidad (${unitLabel(concept.unit)})`}
                          accessibilityLabel={`Cantidad para ${concept.description}`}
                          value={quantities[key] ?? ''}
                          placeholder="0"
                          keyboardType="decimal-pad"
                          onChangeText={(value) =>
                            setQuantities((old) => ({ ...old, [key]: value }))
                          }
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {!visible.length ? (
                <Text variant="label" tone="muted">
                  No hay coincidencias en este capítulo.
                </Text>
              ) : null}
            </Card>
          </>
        ) : null}

        {review
          ? ordered.map((partId) => {
              const part = parts.find((item) => item.id === partId);
              if (!part) return null;
              const concepts = picked
                .filter((item) => item.partId === partId)
                .sort((a, b) => compareSpanish(a.concept.description, b.concept.description));
              return (
                <Card key={partId} style={styles.list}>
                  <View style={styles.reviewHeading}>
                    <Text weight="semibold" tone="strong" style={styles.flex}>
                      {part.name}
                    </Text>
                    <Button
                      label="Subir"
                      variant="ghost"
                      icon="arrow-up"
                      accessibilityLabel={`Subir ${part.name}`}
                      disabled={ordered.indexOf(partId) === 0}
                      onPress={() => move(partId, -1)}
                    />
                    <Button
                      label="Bajar"
                      variant="ghost"
                      icon="arrow-down"
                      accessibilityLabel={`Bajar ${part.name}`}
                      disabled={ordered.indexOf(partId) === ordered.length - 1}
                      onPress={() => move(partId, 1)}
                    />
                  </View>
                  <ListGroup>
                    {concepts.map(({ concept }) => {
                      const quantity = decimal(quantities[conceptKey(partId, concept.id)] ?? '');
                      return (
                        <View key={concept.id} style={styles.reviewItem}>
                          <View style={styles.flex}>
                            <Text>{concept.description}</Text>
                            <Text variant="caption" tone="muted">
                              {quantity > 0
                                ? `${formatQuantity(quantity)} ${unitLabel(concept.unit)}`
                                : 'Cantidad pendiente'}
                            </Text>
                          </View>
                          <Button
                            label="Quitar"
                            variant="ghost"
                            accessibilityLabel={`Quitar ${concept.description}`}
                            onPress={() => toggleConcept(partId, concept.id)}
                          />
                        </View>
                      );
                    })}
                  </ListGroup>
                </Card>
              );
            })
          : null}

        <View style={styles.footer}>
          <Text variant="label" tone="muted" accessibilityLiveRegion="polite">
            {picked.length}{' '}
            {picked.length === 1 ? 'partida seleccionada' : 'partidas seleccionadas'}
          </Text>
          <View style={styles.buttons}>
            {step > 0 ? <Button label="Atrás" variant="secondary" onPress={() => go(-1)} /> : null}
            {step < reviewStep ? (
              <Button
                label="Continuar"
                disabled={stale || (step === 0 && !partIds.length)}
                onPress={() => go(1)}
                testID="structure-next"
              />
            ) : (
              <Button
                label="Crear estructura"
                icon="check"
                disabled={stale || !picked.length}
                onPress={confirm}
                testID="structure-confirm"
              />
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
      <KeyboardToolbar>
        <KeyboardToolbar.Done text="Hecho" />
      </KeyboardToolbar>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  intro: { gap: spacing[1] },
  list: { gap: spacing[3] },
  concept: { gap: spacing[2] },
  quantity: { marginLeft: spacing[8] },
  reviewHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.surface,
  },
  flex: { flex: 1 },
  footer: { gap: spacing[2] },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
});

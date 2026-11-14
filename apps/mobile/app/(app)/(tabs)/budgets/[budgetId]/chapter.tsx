import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { catalogView } from '@bg/domain/catalog/record';
import { compareSpanish } from '@bg/domain/catalog/search';
import { t } from '@bg/domain/i18n';
import { colors, spacing } from '@bg/ui-tokens';
import { DRAFT_ID, runEdit, useActiveBudget } from '../../../../../src/features/budgets/editing';
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

type Mode = 'catalog' | 'custom';

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: { value: Mode; label: string }[] = [
    { value: 'catalog', label: t('addWorkItem.fromCatalog') },
    { value: 'custom', label: t('addWorkItem.custom') },
  ];
  return (
    <View style={styles.switch} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === mode;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: systemColors.ripple }}
            style={[styles.switchItem, selected && styles.switchSelected]}
          >
            <Text variant="label" weight={selected ? 'semibold' : 'regular'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Chapter sheet. Without `chapterId` it adds a chapter (web `AddWorkItemButton`: a catalog chapter
 * not yet in the budget, or a custom name) with its first empty item; with `chapterId` it renames
 * or deletes that chapter (web chapter header).
 */
export default function ChapterSheet() {
  const { budgetId = DRAFT_ID, chapterId } = useLocalSearchParams<{
    budgetId: string;
    chapterId?: string;
  }>();
  const isDraft = budgetId === DRAFT_ID;
  const budget = useActiveBudget();
  const catalogRecord = useCatalogStore((state) => state.record);
  const addWorkItem = useBudgetStore((state) => state.addWorkItem);
  const renameWorkItem = useBudgetStore((state) => state.renameWorkItem);
  const removeWorkItem = useBudgetStore((state) => state.removeWorkItem);
  const [mode, setMode] = useState<Mode>('catalog');
  const [name, setName] = useState('');
  const [rename, setRename] = useState<string | null>(null);
  const chapter = chapterId ? budget?.workItems.find((item) => item.id === chapterId) : undefined;
  const parts = useMemo(
    () => (catalogRecord ? catalogView(catalogRecord).parts : []),
    [catalogRecord],
  );
  const available = useMemo(
    () =>
      parts
        .filter(
          (part) =>
            !budget?.workItems.some(
              (item) =>
                item.catalogPartId === part.id || (!item.catalogPartId && item.name === part.name),
            ),
        )
        .sort((a, b) => compareSpanish(a.name, b.name)),
    [parts, budget],
  );

  const add = (chapterName: string, partId?: string) => {
    const trimmed = chapterName.trim();
    if (!trimmed) return;
    if (runEdit(isDraft, () => addWorkItem(trimmed, partId))) router.back();
  };

  if (chapterId) {
    if (!chapter)
      return (
        <View style={styles.missing}>
          <Text tone="muted">Este capítulo ya no existe.</Text>
          <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />
        </View>
      );
    const remove = () =>
      Alert.alert(t('editor.deleteWorkItemTitle'), t('editor.deleteWorkItemMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (runEdit(isDraft, () => (removeWorkItem(chapter.id), true))) router.back();
          },
        },
      ]);
    return (
      <>
        <Stack.Screen options={{ title: 'Editar capítulo' }} />
        <KeyboardAwareScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            <TextField
              label="Nombre del capítulo"
              value={rename ?? chapter.name}
              autoCapitalize="sentences"
              onChangeText={(value) => {
                setRename(value);
                // An empty name is not a valid chapter: it is kept local until there is text.
                if (value.trim()) runEdit(isDraft, () => renameWorkItem(chapter.id, value));
              }}
              onBlur={() => setRename(null)}
              testID="chapter-name"
            />
            <Text variant="caption" tone="muted">
              {chapter.tasks.length === 1 ? '1 partida' : `${chapter.tasks.length} partidas`}
            </Text>
          </Card>
          <Button label="Hecho" onPress={() => router.back()} />
          <Button
            label="Eliminar capítulo"
            icon="trash-2"
            variant="danger"
            onPress={remove}
            testID="chapter-delete"
          />
        </KeyboardAwareScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('addWorkItem.button') }} />
      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ModeSwitch mode={mode} onChange={setMode} />
        {mode === 'catalog' ? (
          available.length ? (
            <ListGroup>
              {available.map((part) => (
                <ListRow
                  key={part.id}
                  icon="book-open"
                  title={part.name}
                  subtitle={`${part.concepts.length} partidas`}
                  onPress={() => add(part.name, part.id)}
                  testID={`catalog-part-${part.id}`}
                />
              ))}
            </ListGroup>
          ) : (
            <Text variant="label" tone="muted">
              {parts.length
                ? 'Todos los capítulos del catálogo ya están añadidos.'
                : 'Tu catálogo aún no tiene capítulos. Añade uno personalizado.'}
            </Text>
          )
        ) : (
          <Card style={styles.card}>
            <TextField
              label="Nombre del capítulo"
              value={name}
              placeholder={t('addWorkItem.customPlaceholder')}
              autoCapitalize="sentences"
              autoFocus
              returnKeyType="done"
              onChangeText={setName}
              onSubmitEditing={() => add(name)}
              testID="chapter-custom-name"
            />
            <Button
              label={t('common.add')}
              disabled={!name.trim()}
              onPress={() => add(name)}
              testID="chapter-add"
            />
          </Card>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  card: { gap: spacing[3] },
  switch: {
    flexDirection: 'row',
    padding: spacing[1],
    borderRadius: 999,
    backgroundColor: colors['surface-muted'],
  },
  switchItem: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
  switchSelected: { backgroundColor: colors.surface },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    padding: spacing[6],
  },
});

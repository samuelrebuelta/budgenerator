import { useMemo, type ReactNode } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { formatEuros, formatQuantity, unitLabel } from '@bg/domain';
import { budgetView, type BudgetRecord } from '@bg/domain/budget/record';
import { projectWorkItems, ROOT_CHAPTER_ID } from '@bg/domain/construction-document';
import { t } from '@bg/domain/i18n';
import type { Budget, BudgetTask, WorkItem } from '@bg/domain/types';
import { colors, spacing } from '@bg/ui-tokens';
import { useBudgetStore, useTemplateStore } from '../../state/stores';
import {
  Button,
  Card,
  Icon,
  isAndroid,
  isIOS,
  ListGroup,
  ListRow,
  systemColors,
  Text,
} from '../../ui';
import { BudgetActions } from './BudgetActions';
import { BudgetInfoFields } from './BudgetInfoFields';
import { BudgetSummaryCard } from './BudgetSummaryCard';
import { isReadOnly, runEdit } from './editing';
import { chapterAmount, isBlankTask, itemAmount } from './model';

interface Section {
  key: string;
  chapter: WorkItem;
  data: BudgetTask[];
}

function openItem(budgetId: string, chapterId: string, itemId: string) {
  router.push({ pathname: '/budgets/[budgetId]/item', params: { budgetId, chapterId, itemId } });
}

function ChapterHeader({
  budget,
  chapter,
  budgetId,
  readOnly,
}: {
  budget: Budget;
  chapter: WorkItem;
  budgetId: string;
  readOnly: boolean;
}) {
  const amount = formatEuros(chapterAmount(budget, chapter.id));
  const name = chapter.name.toLocaleUpperCase('es');
  const editable = !readOnly && chapter.id !== ROOT_CHAPTER_ID;
  const content = (
    <>
      <Text
        variant="label"
        weight="semibold"
        tone="strong"
        numberOfLines={2}
        style={[styles.chapterName, { paddingLeft: chapter.depth * spacing[3] }]}
      >
        {name}
      </Text>
      <Text variant="label" weight="semibold" tone="muted" style={styles.tabular}>
        {amount}
      </Text>
      {editable ? <Icon name="edit-3" size={14} color={colors['ink-subtle']} /> : null}
    </>
  );
  if (!editable)
    return (
      <View style={styles.chapter} accessibilityRole="header">
        {content}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Capítulo ${chapter.name}, ${amount}. Editar capítulo`}
      onPress={() =>
        router.push({
          pathname: '/budgets/[budgetId]/chapter',
          params: { budgetId, chapterId: chapter.id },
        })
      }
      android_ripple={{ color: systemColors.ripple }}
      style={({ pressed }) => [styles.chapter, pressed && isIOS && styles.pressed]}
      testID={`chapter-${chapter.id}`}
    >
      {content}
    </Pressable>
  );
}

function ItemRow({
  budget,
  chapterId,
  task,
  budgetId,
  last,
}: {
  budget: Budget;
  chapterId: string;
  task: BudgetTask;
  budgetId: string;
  last: boolean;
}) {
  const amount = formatEuros(itemAmount(budget, task));
  const description = task.description || 'Partida sin descripción';
  const detail = `${formatQuantity(task.quantity)} ${unitLabel(task.unit)} × ${formatEuros(task.price)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${description}, ${detail}, ${amount}`}
      onPress={() => openItem(budgetId, chapterId, task.id)}
      android_ripple={{ color: systemColors.ripple }}
      style={({ pressed }) => [
        styles.item,
        last && styles.itemLast,
        pressed && isIOS && styles.pressed,
      ]}
      testID={`item-${task.id}`}
    >
      <View style={styles.itemTexts}>
        <Text numberOfLines={2} tone={task.description ? 'default' : 'muted'}>
          {description}
        </Text>
        <Text variant="caption" tone="muted" style={styles.tabular}>
          {detail}
          {task.measured ? ' · con mediciones' : ''}
        </Text>
      </View>
      <Text
        weight="semibold"
        tone="strong"
        style={styles.tabular}
        testID={`item-amount-${task.id}`}
      >
        {amount}
      </Text>
      {isIOS ? <Icon name="chevron-right" size={14} color={colors['ink-subtle']} /> : null}
    </Pressable>
  );
}

function TemplatePicker() {
  const templates = useTemplateStore((state) => state.templates);
  const startFromTemplate = useBudgetStore((state) => state.startDraftFromTemplate);
  if (!templates.length) return null;
  return (
    <View style={styles.block}>
      <Text variant="label" weight="semibold" tone="muted">
        Reutiliza lo que funciona o empieza desde cero
      </Text>
      <ListGroup>
        {templates.map((template) => (
          <ListRow
            key={template.id}
            icon="layout"
            title={template.document.business.name || 'Plantilla sin nombre'}
            subtitle={`${projectWorkItems(template.document).length} capítulos`}
            onPress={() => startFromTemplate(template)}
          />
        ))}
      </ListGroup>
    </View>
  );
}

export interface BudgetEditorProps {
  budgetId: string;
  record: BudgetRecord;
  isDraft: boolean;
  /** Notices above the client data (draft banner, conflict, accepted, converted). */
  notices?: ReactNode;
}

/**
 * Detail and editor of a budget over the canonical BC3 model (web `BudgetDetailPage` +
 * `BudgetEditor`): chapters as sections of a native `SectionList` with their items, the client
 * data, totals and the actions. Items, chapters and the guided structure open as native sheets.
 * The keyboard never covers the focused field (`react-native-keyboard-controller`).
 */
export function BudgetEditor({ budgetId, record, isDraft, notices }: BudgetEditorProps) {
  const budget = budgetView(record);
  const readOnly = isReadOnly(record);
  const addTask = useBudgetStore((state) => state.addTask);
  const sections = useMemo<Section[]>(
    () => budget.workItems.map((chapter) => ({ key: chapter.id, chapter, data: chapter.tasks })),
    [budget],
  );

  const addItem = (chapterId: string) => {
    const itemId = runEdit(isDraft, () => addTask(chapterId));
    if (itemId) openItem(budgetId, chapterId, itemId);
  };

  const header = (
    <View style={styles.header}>
      {notices}
      {isDraft && !budget.workItems.length ? <TemplatePicker /> : null}
      {isDraft ? (
        <Button
          label="Crear paso a paso"
          icon="check-square"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/budgets/[budgetId]/structure', params: { budgetId } })
          }
          testID="budget-structure-button"
        />
      ) : null}
      <BudgetInfoFields info={budget.info} isDraft={isDraft} readOnly={readOnly} />
      <Text variant="label" weight="semibold" tone="muted" style={styles.sectionTitle}>
        {t('budget.workItems').toLocaleUpperCase('es')}
      </Text>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {!readOnly ? (
        <Button
          label={t('addWorkItem.button')}
          icon="plus"
          variant="secondary"
          onPress={() => {
            if (isDraft || runEdit(false, () => true))
              router.push({ pathname: '/budgets/[budgetId]/chapter', params: { budgetId } });
          }}
          testID="budget-add-chapter"
        />
      ) : null}
      {budget.workItems.length ? (
        <BudgetSummaryCard record={record} isDraft={isDraft} readOnly={readOnly} />
      ) : null}
      {!isDraft ? <BudgetActions record={record} /> : null}
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(task) => task.id}
      renderSectionHeader={({ section }) => (
        <ChapterHeader
          budget={budget}
          chapter={section.chapter}
          budgetId={budgetId}
          readOnly={readOnly}
        />
      )}
      renderItem={({ item, section, index }) => (
        <ItemRow
          budget={budget}
          chapterId={section.chapter.id}
          task={item}
          budgetId={budgetId}
          last={index === section.data.length - 1 && readOnly}
        />
      )}
      renderSectionFooter={({ section }) =>
        readOnly ? (
          <View style={styles.sectionGap} />
        ) : (
          <View style={styles.sectionFooter}>
            <Button
              label={t('editor.addTask')}
              icon="plus"
              variant="ghost"
              disabled={section.data.some(isBlankTask)}
              onPress={() => addItem(section.chapter.id)}
              testID={`add-item-${section.chapter.id}`}
            />
          </View>
        )
      }
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <Card style={styles.empty}>
          <Text variant="title" tone="strong" style={styles.center}>
            {t('editor.emptyWorkItems')}
          </Text>
          <Text tone="muted" style={styles.center}>
            {t('editor.emptyWorkItemsHint')}
          </Text>
        </Card>
      }
      stickySectionHeadersEnabled={isIOS}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      renderScrollComponent={(props) => <KeyboardAwareScrollView {...props} bottomOffset={24} />}
      style={styles.list}
      contentContainerStyle={styles.content}
      testID="budget-editor"
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing[12] },
  header: { padding: spacing[4], gap: spacing[3] },
  block: { gap: spacing[2] },
  sectionTitle: { letterSpacing: 0.5, marginTop: spacing[2] },
  chapter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[4],
    paddingHorizontal: spacing[4],
    minHeight: isAndroid ? 56 : 48,
    backgroundColor: colors['surface-muted'],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderCurve: 'continuous',
  },
  chapterName: { flex: 1, letterSpacing: 0.3 },
  pressed: { backgroundColor: colors.highlight },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginHorizontal: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: isAndroid ? 72 : 60,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  itemLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  itemTexts: { flex: 1, gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  sectionFooter: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    alignItems: 'flex-start',
  },
  sectionGap: { height: spacing[4] },
  footer: { padding: spacing[4], gap: spacing[4] },
  empty: { marginHorizontal: spacing[4], gap: spacing[2], alignItems: 'center' },
  center: { textAlign: 'center' },
});

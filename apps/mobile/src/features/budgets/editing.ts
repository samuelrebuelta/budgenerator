import { Alert } from 'react-native';
import { activeRecord } from '@bg/app-core/stores/budget';
import { budgetView, type BudgetRecord } from '@bg/domain/budget/record';
import { toUserMessage } from '@bg/domain/lib/errors';
import type { Budget } from '@bg/domain/types';
import { useBudgetStore } from '../../state/stores';
import { allowSavedMutation } from './offline';

export const DRAFT_ID = 'new';

/** Budget open in the editor: the draft for `new`, otherwise the saved record. */
export function useEditorRecord(budgetId: string): BudgetRecord | undefined {
  return useBudgetStore((state) =>
    budgetId === DRAFT_ID
      ? (state.draft ?? undefined)
      : state.records.find((record) => record.id === budgetId),
  );
}

/** Derived view (`budgetView`, memoized per record) of the record the store edits. */
export function useActiveBudget(): Budget | undefined {
  return useBudgetStore((state) => {
    const record = activeRecord(state);
    return record ? budgetView(record) : undefined;
  });
}

/** Accepted or converted budgets are a read-only reference of the accepted offer (web). */
export function isReadOnly(record: Pick<BudgetRecord, 'acceptedAt' | 'projectId'> | undefined) {
  return !!record?.acceptedAt || !!record?.projectId;
}

/**
 * Applies an edit through the shared store (`updateTask`, `addWorkItem`…). A saved budget is only
 * edited online (D4: the change would be a `WriteQueue` write); a draft is local until saved. The
 * store rejects edits that break the BC3 invariants with a message, shown as an alert.
 */
export function runEdit<T>(isDraft: boolean, edit: () => T): T | undefined {
  if (!isDraft && !allowSavedMutation()) return undefined;
  try {
    return edit();
  } catch (error) {
    Alert.alert(
      'Revisa el presupuesto',
      toUserMessage(error, 'No se ha podido aplicar el cambio.'),
    );
    return undefined;
  }
}

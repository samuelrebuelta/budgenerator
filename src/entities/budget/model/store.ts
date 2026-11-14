import { useMemo } from 'react';
import { sessionDraftStorage } from '@/shared/platform';
import { activeRecord, createBudgetStore } from '@bg/app-core/stores/budget';
import type { Budget } from '@/shared/types';
import { bindStore } from '@/shared/lib/bindStore';
import { useUserStore } from '@/entities/user';
import * as budgetApi from '../api/firestore';
import { createBudgetAcceptanceApi } from '../api/acceptance';
import { budgetView, type BudgetRecord } from './record';

export type { TemplateSource, BudgetState } from '@bg/app-core/stores/budget';

/** Web binding of the shared budget store (`@bg/app-core`); drafts live in `sessionStorage`. */
const budget = createBudgetStore({
  repository: budgetApi,
  acceptance: async () => {
    const { db } = await import('@/shared/firebase/config');
    return createBudgetAcceptanceApi(db);
  },
  user: {
    canCreateBudget: () => useUserStore.getState().canCreateBudget(),
    setUserData: (userData) => useUserStore.setState({ userData }),
  },
  drafts: sessionDraftStorage,
});

export const useBudgetStore = bindStore(budget.store);
export const resetBudgetStore = budget.reset;
export const clearBudgetWrites = budget.clearWrites;
export const flushBudgetWrites = budget.flushWrites;

export function setBudgetAuthGetter(_fn: () => string | null) {
  void _fn;
}

/** Derived view of the budget or template being edited. */
export function useActiveBudget(): Budget | undefined {
  return useBudgetStore((s) => {
    const record = activeRecord(s);
    return record ? budgetView(record) : undefined;
  });
}

export function useActiveBudgetRecord(): BudgetRecord | undefined {
  return useBudgetStore((s) => activeRecord(s));
}

/** Derived views of all saved budgets. */
export function useBudgets(): Budget[] {
  const records = useBudgetStore((s) => s.records);
  return useMemo(() => records.map(budgetView), [records]);
}

export function getBudgetViews(): Budget[] {
  return useBudgetStore.getState().records.map(budgetView);
}

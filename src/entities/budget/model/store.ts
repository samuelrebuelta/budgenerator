import { create } from 'zustand';
import type { Budget, BudgetAdjustment, BudgetInfo, BudgetTask, BudgetTemplate, WorkItem, Unit } from '@/shared/types';
import { generateId } from '@/shared/lib';
import {
  fetchBudgets,
  saveBudget,
  deleteBudgetDoc,
} from '@/entities/budget/api/firestore';
import { useUserStore } from '@/entities/user';

const DEFAULT_IVA_RATE = 0.10;

function createEmptyTask(): BudgetTask {
  return {
    id: generateId(),
    description: '',
    quantity: 0,
    unit: 'm2',
    price: 0,
    cost: 0,
  };
}

function createEmptyWorkItem(name: string): WorkItem {
  return {
    id: generateId(),
    name,
    tasks: [createEmptyTask()],
  };
}

function getTaskAmountRaw(task: BudgetTask): number {
  return task.quantity * task.price;
}

function calcWorkItemSubtotal(workItem: WorkItem): number {
  return workItem.tasks.reduce((sum, t) => sum + getTaskAmountRaw(t), 0);
}

function calcBudgetTotal(budget: Budget): number {
  const rawSubtotal = budget.workItems.reduce((sum, wi) => sum + calcWorkItemSubtotal(wi), 0);
  const multiplier = budget.adjustment?.multiplier ?? 1;
  const adjusted = rawSubtotal * multiplier;
  const ivaRate = budget.ivaRate ?? DEFAULT_IVA_RATE;
  return adjusted + adjusted * ivaRate;
}

function createDraftBudget(nextNumber: string): Budget {
  return {
    id: '',
    info: {
      clientName: '',
      address: '',
      date: new Date().toISOString().split('T')[0] || '',
      budgetNumber: nextNumber,
    },
    workItems: [],
    createdAt: '',
  };
}

// Helpers to work on draft OR active budget transparently
type StateSlice = Pick<BudgetState, 'budgets' | 'activeBudgetId' | 'draftBudget'>;

function getActive(state: StateSlice): Budget | undefined {
  return state.draftBudget ?? state.budgets.find((b) => b.id === state.activeBudgetId);
}

function updateActive(state: StateSlice, updater: (b: Budget) => Budget) {
  if (state.draftBudget) {
    return { draftBudget: updater(state.draftBudget) };
  }
  return {
    budgets: state.budgets.map((b) =>
      b.id === state.activeBudgetId ? updater(b) : b,
    ),
  };
}

interface BudgetState {
  budgets: Budget[];
  activeBudgetId: string | null;
  draftBudget: Budget | null;
  loaded: boolean;

  // Data loading
  loadBudgets: (uid: string) => Promise<void>;

  // Draft lifecycle
  startDraft: () => void;
  startDraftFromTemplate: (template: BudgetTemplate) => void;
  saveDraft: () => Promise<string>;
  discardDraft: () => void;

  // Multi-budget actions
  deleteBudget: (id: string) => Promise<void>;
  setActiveBudget: (id: string | null) => void;
  getBudgetTotal: (budgetId: string) => number;

  // Active budget computed
  getWorkItemSubtotal: (workItemId: string) => number;
  getRawSubtotal: () => number;
  getSubtotal: () => number;
  getIva: () => number;
  getTotal: () => number;
  getTaskAmount: (task: BudgetTask) => number;

  // Active budget mutations
  updateInfo: (info: Partial<BudgetInfo>) => void;
  addWorkItem: (name: string) => void;
  removeWorkItem: (workItemId: string) => void;
  renameWorkItem: (workItemId: string, name: string) => void;
  addTask: (workItemId: string) => void;
  removeTask: (workItemId: string, taskId: string) => void;
  updateTask: (workItemId: string, taskId: string, updates: Partial<BudgetTask>) => void;
  applyTariff: (workItemId: string, taskId: string, description: string, unit: Unit, price: number, cost: number) => void;
  updateAdjustment: (adjustment: BudgetAdjustment | undefined) => void;
  updateIvaRate: (rate: number) => void;
  resetBudget: () => void;
}

/** Get the UID from the auth store */
let _getUid: (() => string | null) | null = null;

export function setBudgetAuthGetter(fn: () => string | null) {
  _getUid = fn;
}

function getUid(): string | null {
  return _getUid?.() ?? null;
}

function isTaskComplete(t: BudgetTask): boolean {
  return t.description.trim() !== '' && t.quantity > 0 && t.price > 0;
}

/** Persist a budget to Firestore if it's NOT a draft (debounced 1s) */
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

function syncToFirestore(budget: Budget) {
  const uid = getUid();
  if (!uid || !budget.id) return;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    const cleaned: Budget = {
      ...budget,
      workItems: budget.workItems.map((wi) => ({
        ...wi,
        tasks: wi.tasks.filter(isTaskComplete),
      })),
    };
    saveBudget(uid, cleaned);
    _syncTimer = null;
  }, 1000);
}

export const useBudgetStore = create<BudgetState>()(
  (set, get) => ({
    budgets: [],
    activeBudgetId: null,
    draftBudget: null,
    loaded: false,

    // --- Data loading ---

    loadBudgets: async (uid) => {
      const budgets = await fetchBudgets(uid);
      const currentActive = get().activeBudgetId;
      const stillExists = budgets.some((b) => b.id === currentActive);
      set({
        budgets,
        activeBudgetId: stillExists ? currentActive : null,
        draftBudget: null,
        loaded: true,
      });
    },

    // --- Draft lifecycle ---

    startDraft: () =>
      set((state) => {
        if (state.draftBudget) return {};
        const nums = state.budgets
          .map((b) => parseInt(b.info.budgetNumber, 10))
          .filter((n) => !isNaN(n));
        const next = nums.length > 0 ? String(Math.max(...nums) + 1) : '1';
        return { draftBudget: createDraftBudget(next), activeBudgetId: null };
      }),

    startDraftFromTemplate: (template) =>
      set((state) => {
        if (state.draftBudget) return {};
        const nums = state.budgets
          .map((b) => parseInt(b.info.budgetNumber, 10))
          .filter((n) => !isNaN(n));
        const next = nums.length > 0 ? String(Math.max(...nums) + 1) : '1';
        const draft = createDraftBudget(next);
        draft.workItems = template.workItems.map((wi) => ({
          ...wi,
          id: generateId(),
          tasks: wi.tasks.map((task) => ({ ...task, id: generateId() })),
        }));
        if (template.adjustment) draft.adjustment = template.adjustment;
        return { draftBudget: draft, activeBudgetId: null };
      }),

    saveDraft: async () => {
      const draft = get().draftBudget;
      if (!draft) return '';
      const uid = getUid();
      if (!uid) return '';
      const saved: Budget = {
        ...draft,
        id: generateId(),
        createdAt: new Date().toISOString(),
        workItems: draft.workItems.map((wi) => ({
          ...wi,
          tasks: wi.tasks.filter(isTaskComplete),
        })),
      };
      await saveBudget(uid, saved);
      await useUserStore.getState().onBudgetCreated(uid);
      set({
        budgets: [...get().budgets, saved],
        activeBudgetId: saved.id,
        draftBudget: null,
      });
      return saved.id;
    },

    discardDraft: () => set({ draftBudget: null }),

    // --- Multi-budget ---

    deleteBudget: async (id) => {
      const uid = getUid();
      if (uid) await deleteBudgetDoc(uid, id);
      set((state) => ({
        budgets: state.budgets.filter((b) => b.id !== id),
        activeBudgetId: state.activeBudgetId === id ? null : state.activeBudgetId,
      }));
    },

    setActiveBudget: (id) => set({ activeBudgetId: id }),

    getBudgetTotal: (budgetId) => {
      const budget = get().budgets.find((b) => b.id === budgetId);
      return budget ? calcBudgetTotal(budget) : 0;
    },

    // --- Active budget computed ---

    getTaskAmount: (task) => {
      const budget = getActive(get());
      const mult = budget?.adjustment?.multiplier ?? 1;
      // Surcharge (mult > 1): bake into each task. Discount: keep raw.
      return getTaskAmountRaw(task) * (mult > 1 ? mult : 1);
    },

    getWorkItemSubtotal: (workItemId) => {
      const budget = getActive(get());
      const workItem = budget?.workItems.find((wi) => wi.id === workItemId);
      if (!workItem) return 0;
      const raw = calcWorkItemSubtotal(workItem);
      const mult = budget?.adjustment?.multiplier ?? 1;
      return raw * (mult > 1 ? mult : 1);
    },

    getRawSubtotal: () => {
      const budget = getActive(get());
      return budget
        ? budget.workItems.reduce((sum, wi) => sum + calcWorkItemSubtotal(wi), 0)
        : 0;
    },

    getSubtotal: () => {
      const budget = getActive(get());
      const raw = get().getRawSubtotal();
      const multiplier = budget?.adjustment?.multiplier ?? 1;
      return raw * multiplier;
    },

    getIva: () => {
      const budget = getActive(get());
      const ivaRate = budget?.ivaRate ?? DEFAULT_IVA_RATE;
      return get().getSubtotal() * ivaRate;
    },

    getTotal: () => {
      const budget = getActive(get());
      const ivaRate = budget?.ivaRate ?? DEFAULT_IVA_RATE;
      const subtotal = get().getSubtotal();
      return subtotal + subtotal * ivaRate;
    },

    // --- Active budget mutations ---

    updateInfo: (info) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          info: { ...b.info, ...info },
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    addWorkItem: (name) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          workItems: [...b.workItems, createEmptyWorkItem(name)],
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    removeWorkItem: (workItemId) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          workItems: b.workItems.filter((wi) => wi.id !== workItemId),
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    renameWorkItem: (workItemId, name) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          workItems: b.workItems.map((wi) =>
            wi.id === workItemId ? { ...wi, name } : wi,
          ),
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    addTask: (workItemId) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          workItems: b.workItems.map((wi) =>
            wi.id === workItemId ? { ...wi, tasks: [...wi.tasks, createEmptyTask()] } : wi,
          ),
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    removeTask: (workItemId, taskId) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          workItems: b.workItems.map((wi) =>
            wi.id === workItemId
              ? { ...wi, tasks: wi.tasks.filter((t) => t.id !== taskId) }
              : wi,
          ),
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    updateTask: (workItemId, taskId, updates) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          workItems: b.workItems.map((wi) =>
            wi.id === workItemId
              ? {
                  ...wi,
                  tasks: wi.tasks.map((t) =>
                    t.id === taskId ? { ...t, ...updates } : t,
                  ),
                }
              : wi,
          ),
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    applyTariff: (workItemId, taskId, description, unit, price, cost) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          workItems: b.workItems.map((wi) =>
            wi.id === workItemId
              ? {
                  ...wi,
                  tasks: wi.tasks.map((t) =>
                    t.id === taskId ? { ...t, description, unit, price, cost } : t,
                  ),
                }
              : wi,
          ),
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    updateAdjustment: (adjustment) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          adjustment,
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    updateIvaRate: (rate) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          ivaRate: rate,
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    resetBudget: () =>
      set((state) => {
        const budget = getActive(state);
        if (!budget) return {};
        const patch = updateActive(state, (b) => ({
          ...b,
          info: { clientName: '', address: '', date: new Date().toISOString().split('T')[0] || '', budgetNumber: '' },
          workItems: [],
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),
  }),
);

/** Selector hook: returns the active budget (draft or persisted) */
export function useActiveBudget() {
  return useBudgetStore((s) =>
    s.draftBudget ?? s.budgets.find((b) => b.id === s.activeBudgetId),
  );
}

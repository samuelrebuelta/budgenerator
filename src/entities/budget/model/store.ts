import { create } from 'zustand';
import type { Budget, BudgetAdjustment, BudgetInfo, BudgetRow, Section, Unit } from '@/shared/types';
import { generateId } from '@/shared/lib';
import {
  fetchBudgets,
  saveBudget,
  deleteBudgetDoc,
} from '@/shared/firebase';

const IVA_RATE = 0.10;

function createEmptyRow(): BudgetRow {
  return {
    id: generateId(),
    description: '',
    quantity: 0,
    unit: 'm2',
    price: 0,
    cost: 0,
  };
}

function createEmptySection(name: string): Section {
  return {
    id: generateId(),
    name,
    rows: [createEmptyRow()],
  };
}

function getRowAmount(row: BudgetRow): number {
  return row.quantity * row.price;
}

function calcSectionSubtotal(section: Section): number {
  return section.rows.reduce((sum, row) => sum + getRowAmount(row), 0);
}

function calcBudgetTotal(budget: Budget): number {
  const rawSubtotal = budget.sections.reduce((sum, s) => sum + calcSectionSubtotal(s), 0);
  const multiplier = budget.adjustment?.multiplier ?? 1;
  const adjusted = rawSubtotal * multiplier;
  return adjusted + adjusted * IVA_RATE;
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
    sections: [],
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
  saveDraft: () => Promise<string>;
  discardDraft: () => void;

  // Multi-budget actions
  deleteBudget: (id: string) => Promise<void>;
  setActiveBudget: (id: string | null) => void;
  getBudgetTotal: (budgetId: string) => number;

  // Active budget computed
  getSectionSubtotal: (sectionId: string) => number;
  getRawSubtotal: () => number;
  getSubtotal: () => number;
  getIva: () => number;
  getTotal: () => number;
  getRowAmount: (row: BudgetRow) => number;

  // Active budget mutations
  updateInfo: (info: Partial<BudgetInfo>) => void;
  addSection: (name: string) => void;
  removeSection: (sectionId: string) => void;
  renameSection: (sectionId: string, name: string) => void;
  addRow: (sectionId: string) => void;
  removeRow: (sectionId: string, rowId: string) => void;
  updateRow: (sectionId: string, rowId: string, updates: Partial<BudgetRow>) => void;
  applyTariff: (sectionId: string, rowId: string, description: string, unit: Unit, price: number, cost: number) => void;
  updateAdjustment: (adjustment: BudgetAdjustment | undefined) => void;
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

function isRowComplete(r: BudgetRow): boolean {
  return r.description.trim() !== '' && r.quantity > 0 && r.price > 0;
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
      sections: budget.sections.map((s) => ({
        ...s,
        rows: s.rows.filter(isRowComplete),
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

    saveDraft: async () => {
      const draft = get().draftBudget;
      if (!draft) return '';
      const uid = getUid();
      if (!uid) return '';
      const saved: Budget = {
        ...draft,
        id: generateId(),
        createdAt: new Date().toISOString(),
        sections: draft.sections.map((s) => ({
          ...s,
          rows: s.rows.filter(isRowComplete),
        })),
      };
      await saveBudget(uid, saved);
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

    getRowAmount: (row) => getRowAmount(row),

    getSectionSubtotal: (sectionId) => {
      const budget = getActive(get());
      const section = budget?.sections.find((s) => s.id === sectionId);
      return section ? calcSectionSubtotal(section) : 0;
    },

    getRawSubtotal: () => {
      const budget = getActive(get());
      return budget
        ? budget.sections.reduce((sum, s) => sum + calcSectionSubtotal(s), 0)
        : 0;
    },

    getSubtotal: () => {
      const budget = getActive(get());
      const raw = get().getRawSubtotal();
      const multiplier = budget?.adjustment?.multiplier ?? 1;
      return raw * multiplier;
    },

    getIva: () => get().getSubtotal() * IVA_RATE,

    getTotal: () => {
      const subtotal = get().getSubtotal();
      return subtotal + subtotal * IVA_RATE;
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

    addSection: (name) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          sections: [...b.sections, createEmptySection(name)],
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    removeSection: (sectionId) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          sections: b.sections.filter((s) => s.id !== sectionId),
        }));
        if (!state.draftBudget) {
          const updated = (patch as { budgets: Budget[] }).budgets?.find(
            (b) => b.id === state.activeBudgetId,
          );
          if (updated) syncToFirestore(updated);
        }
        return patch;
      }),

    renameSection: (sectionId, name) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          sections: b.sections.map((s) =>
            s.id === sectionId ? { ...s, name } : s,
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

    addRow: (sectionId) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          sections: b.sections.map((s) =>
            s.id === sectionId ? { ...s, rows: [...s.rows, createEmptyRow()] } : s,
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

    removeRow: (sectionId, rowId) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          sections: b.sections.map((s) =>
            s.id === sectionId
              ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) }
              : s,
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

    updateRow: (sectionId, rowId, updates) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          sections: b.sections.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  rows: s.rows.map((r) =>
                    r.id === rowId ? { ...r, ...updates } : r,
                  ),
                }
              : s,
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

    applyTariff: (sectionId, rowId, description, unit, price, cost) =>
      set((state) => {
        const patch = updateActive(state, (b) => ({
          ...b,
          sections: b.sections.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  rows: s.rows.map((r) =>
                    r.id === rowId ? { ...r, description, unit, price, cost } : r,
                  ),
                }
              : s,
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

    resetBudget: () =>
      set((state) => {
        const budget = getActive(state);
        if (!budget) return {};
        const patch = updateActive(state, (b) => ({
          ...b,
          info: { clientName: '', address: '', date: new Date().toISOString().split('T')[0] || '', budgetNumber: '' },
          sections: [],
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

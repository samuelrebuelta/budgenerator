import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Budget, BudgetInfo, BudgetRow, Section, Unit } from '@/shared/types';
import { generateId } from '@/shared/lib';

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
  const subtotal = budget.sections.reduce((sum, s) => sum + calcSectionSubtotal(s), 0);
  return subtotal + subtotal * IVA_RATE;
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

  // Draft lifecycle
  startDraft: () => void;
  saveDraft: () => string;
  discardDraft: () => void;

  // Multi-budget actions
  deleteBudget: (id: string) => void;
  setActiveBudget: (id: string | null) => void;
  getBudgetTotal: (budgetId: string) => number;

  // Active budget computed
  getSectionSubtotal: (sectionId: string) => number;
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
  resetBudget: () => void;
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      budgets: [],
      activeBudgetId: null,
      draftBudget: null,

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

      saveDraft: () => {
        const draft = get().draftBudget;
        if (!draft) return '';
        const saved: Budget = {
          ...draft,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set({
          budgets: [...get().budgets, saved],
          activeBudgetId: saved.id,
          draftBudget: null,
        });
        return saved.id;
      },

      discardDraft: () => set({ draftBudget: null }),

      // --- Multi-budget ---

      deleteBudget: (id) =>
        set((state) => ({
          budgets: state.budgets.filter((b) => b.id !== id),
          activeBudgetId: state.activeBudgetId === id ? null : state.activeBudgetId,
        })),

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

      getSubtotal: () => {
        const budget = getActive(get());
        return budget
          ? budget.sections.reduce((sum, s) => sum + calcSectionSubtotal(s), 0)
          : 0;
      },

      getIva: () => get().getSubtotal() * IVA_RATE,

      getTotal: () => {
        const subtotal = get().getSubtotal();
        return subtotal + subtotal * IVA_RATE;
      },

      // --- Active budget mutations ---

      updateInfo: (info) =>
        set((state) => updateActive(state, (b) => ({
          ...b,
          info: { ...b.info, ...info },
        }))),

      addSection: (name) =>
        set((state) => updateActive(state, (b) => ({
          ...b,
          sections: [...b.sections, createEmptySection(name)],
        }))),

      removeSection: (sectionId) =>
        set((state) => updateActive(state, (b) => ({
          ...b,
          sections: b.sections.filter((s) => s.id !== sectionId),
        }))),

      renameSection: (sectionId, name) =>
        set((state) => updateActive(state, (b) => ({
          ...b,
          sections: b.sections.map((s) =>
            s.id === sectionId ? { ...s, name } : s,
          ),
        }))),

      addRow: (sectionId) =>
        set((state) => updateActive(state, (b) => ({
          ...b,
          sections: b.sections.map((s) =>
            s.id === sectionId ? { ...s, rows: [...s.rows, createEmptyRow()] } : s,
          ),
        }))),

      removeRow: (sectionId, rowId) =>
        set((state) => updateActive(state, (b) => ({
          ...b,
          sections: b.sections.map((s) =>
            s.id === sectionId
              ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) }
              : s,
          ),
        }))),

      updateRow: (sectionId, rowId, updates) =>
        set((state) => updateActive(state, (b) => ({
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
        }))),

      applyTariff: (sectionId, rowId, description, unit, price, cost) =>
        set((state) => updateActive(state, (b) => ({
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
        }))),

      resetBudget: () =>
        set((state) => {
          const budget = getActive(state);
          if (!budget) return {};
          return updateActive(state, (b) => ({
            ...b,
            info: { clientName: '', address: '', date: new Date().toISOString().split('T')[0] || '', budgetNumber: '' },
            sections: [],
          }));
        }),
    }),
    {
      name: 'renovation-budget-data',
      partialize: (state) => ({
        budgets: state.budgets,
        activeBudgetId: state.activeBudgetId,
      }),
    },
  ),
);

/** Selector hook: returns the active budget (draft or persisted) */
export function useActiveBudget() {
  return useBudgetStore((s) =>
    s.draftBudget ?? s.budgets.find((b) => b.id === s.activeBudgetId),
  );
}

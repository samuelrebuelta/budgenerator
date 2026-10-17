import { create } from 'zustand';
import type {
  Budget,
  BudgetAdjustment,
  BudgetInfo,
  BudgetTask,
  BudgetTemplate,
  Unit,
  WorkItem,
} from '@/shared/types';
import { generateId } from '@/shared/lib';
import { assertBudget, budgetTotals, taskAmount, workItemAmount } from '@/shared/lib/budgetMath';
import { WriteQueue } from '@/shared/lib/writeQueue';
import { isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import { registerFlusher } from '@/shared/model/sync';
import { fetchBudgets, saveBudget, createBudget, deleteBudgetDoc } from '../api/firestore';
import { useUserStore } from '@/entities/user';

interface BudgetState {
  budgets: Budget[];
  activeBudgetId: string | null;
  draftBudget: Budget | null;
  loaded: boolean;
  draftKey: string | null;
  draftDirty: boolean;
  savingDraft: boolean;
  loadBudgets: (uid: string) => Promise<void>;
  startDraft: (catalogId?: string) => void;
  startDraftFromTemplate: (template: BudgetTemplate) => void;
  loadTemplateForEditing: (template: BudgetTemplate) => void;
  saveDraft: () => Promise<string>;
  discardDraft: () => void;
  deleteBudget: (id: string) => Promise<void>;
  setActiveBudget: (id: string | null) => void;
  getBudgetTotal: (id: string) => number;
  getWorkItemSubtotal: (id: string) => number;
  getRawSubtotal: () => number;
  getSubtotal: () => number;
  getIva: () => number;
  getTotal: () => number;
  getTaskAmount: (task: BudgetTask) => number;
  updateInfo: (info: Partial<BudgetInfo>) => void;
  addWorkItem: (name: string, catalogPartId?: string) => void;
  appendStructure: (items: WorkItem[], expected: Budget) => void;
  removeWorkItem: (id: string) => void;
  renameWorkItem: (id: string, name: string) => void;
  addTask: (id: string) => void;
  removeTask: (workItemId: string, id: string) => void;
  updateTask: (workItemId: string, id: string, patch: Partial<BudgetTask>) => void;
  applyTariff: (
    workItemId: string,
    id: string,
    catalogPartId: string,
    catalogConceptId: string,
    description: string,
    unit: Unit,
    price: number,
    cost: number,
  ) => void;
  updateAdjustment: (value: BudgetAdjustment | undefined) => void;
  updateIvaRate: (rate: number) => void;
  setBudgetCatalog: (id: string) => void;
  resetBudget: () => void;
}
const emptyTask = (): BudgetTask => ({
  id: generateId(),
  description: '',
  quantity: 0,
  unit: 'm2',
  price: 0,
  cost: 0,
});
const active = (s: Pick<BudgetState, 'draftBudget' | 'budgets' | 'activeBudgetId'>) =>
  s.draftBudget ?? s.budgets.find((b) => b.id === s.activeBudgetId);
function draftStorage(key: string) {
  return `cimbra-draft:${sessionUid()}:${key}`;
}
function rememberDraft(key: string | null, budget: Budget | null) {
  if (!key) return;
  try {
    if (budget) sessionStorage.setItem(draftStorage(key), JSON.stringify(budget));
    else sessionStorage.removeItem(draftStorage(key));
  } catch {
    /* Storage can be unavailable in private mode. */
  }
}
function recoverDraft(key: string, fallback: Budget): Budget {
  try {
    const raw = sessionStorage.getItem(draftStorage(key));
    if (raw) {
      const parsed = JSON.parse(raw) as Budget;
      assertBudget(parsed);
      return parsed;
    }
  } catch {
    /* Keep the valid server/default document. */
  }
  return fallback;
}
const queue = new WriteQueue<Budget>('budget:', async (key, budget) => {
  const uid = key.split('/')[0]!;
  await saveBudget(uid, budget);
});
let draftSave: Promise<string> | null = null;
let creationId: string | null = null;
registerFlusher(async () => {
  await draftSave;
});
export function clearBudgetWrites() {
  queue.clear();
  creationId = null;
  draftSave = null;
}
export function flushBudgetWrites() {
  return queue.flush();
}
export function setBudgetAuthGetter(_fn: () => string | null) {
  void _fn;
}
const initial = {
  budgets: [] as Budget[],
  activeBudgetId: null as string | null,
  draftBudget: null as Budget | null,
  draftKey: null as string | null,
  loaded: false,
  draftDirty: false,
  savingDraft: false,
};
export function resetBudgetStore() {
  clearBudgetWrites();
  useBudgetStore.setState(initial);
}
export const useBudgetStore = create<BudgetState>((set, get) => {
  const edit = (updater: (budget: Budget) => Budget) => {
    if (get().savingDraft) return;
    const current = active(get());
    if (!current) return;
    const next = updater(current);
    assertBudget(next);
    if (get().draftBudget) {
      set({ draftBudget: next, draftDirty: true });
      rememberDraft(get().draftKey, next);
    } else {
      set((s) => ({ budgets: s.budgets.map((b) => (b.id === next.id ? next : b)) }));
      const uid = sessionUid();
      if (uid) queue.schedule(`${uid}/${next.id}`, next);
    }
  };
  const modifyItem = (id: string, fn: (item: WorkItem) => WorkItem) =>
    edit((b) => ({
      ...b,
      workItems: b.workItems.map((item) => (item.id === id ? fn(item) : item)),
    }));
  const totals = () => {
    const b = active(get());
    return b ? budgetTotals(b) : { raw: 0, subtotal: 0, iva: 0, total: 0 };
  };
  const newDraft = (catalogId?: string): Budget => ({
    id: '',
    info: {
      clientName: '',
      address: '',
      date: new Date().toLocaleDateString('en-CA'),
      budgetNumber: String(
        Math.max(0, ...get().budgets.map((b) => parseInt(b.info.budgetNumber, 10) || 0)) + 1,
      ),
    },
    workItems: [],
    ...(catalogId ? { catalogId } : {}),
    createdAt: '',
  });
  const openDraft = (key: string, budget: Budget) => {
    creationId = null;
    const restored = recoverDraft(key, budget);
    set({
      draftBudget: restored,
      draftKey: key,
      draftDirty:
        JSON.stringify(restored) !== JSON.stringify(budget) ||
        (key === 'budget' && budget.workItems.length > 0),
      activeBudgetId: null,
    });
    rememberDraft(key, restored);
  };
  return {
    ...initial,
    loadBudgets: async (uid) => {
      const revision = sessionRevision();
      const budgets = await fetchBudgets(uid);
      if (!isSessionCurrent(uid, revision)) return;
      set({
        budgets: budgets.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        loaded: true,
      });
    },
    startDraft: (catalogId) => {
      if (!get().draftBudget || get().draftKey !== 'budget')
        openDraft('budget', newDraft(catalogId));
    },
    startDraftFromTemplate: (template) => {
      const budget = {
        ...newDraft(template.catalogId),
        workItems: template.workItems.map((wi) => ({
          ...wi,
          id: generateId(),
          tasks: wi.tasks.map((t) => ({ ...t, id: generateId() })),
        })),
        adjustment: template.adjustment,
        ivaRate: template.ivaRate,
      };
      rememberDraft('budget', null);
      openDraft('budget', budget);
    },
    loadTemplateForEditing: (template) =>
      openDraft(`template:${template.id || 'new'}`, {
        id: template.id,
        info: { clientName: template.name, address: '', date: '', budgetNumber: '' },
        workItems: structuredClone(template.workItems),
        catalogId: template.catalogId,
        adjustment: template.adjustment,
        ivaRate: template.ivaRate,
        createdAt: template.createdAt,
      }),
    saveDraft: () => {
      if (draftSave) return draftSave;
      const draft = get().draftBudget;
      const uid = sessionUid();
      if (!draft || !uid || get().draftKey !== 'budget') return Promise.resolve('');
      if (!useUserStore.getState().canCreateBudget())
        return Promise.reject(new Error('Has alcanzado el límite de tu plan.'));
      assertBudget(draft);
      creationId ??= generateId();
      const saved = { ...draft, id: creationId, createdAt: new Date().toISOString() };
      const revision = sessionRevision();
      set({ savingDraft: true });
      draftSave = (async () => {
        try {
          const userData = await createBudget(uid, saved);
          if (isSessionCurrent(uid, revision)) {
            useUserStore.setState({ userData });
            rememberDraft(get().draftKey, null);
            set((s) => ({
              budgets: [...s.budgets.filter((b) => b.id !== saved.id), saved],
              activeBudgetId: saved.id,
              draftBudget: null,
              draftKey: null,
              draftDirty: false,
            }));
            creationId = null;
          }
          return saved.id;
        } finally {
          if (isSessionCurrent(uid, revision)) set({ savingDraft: false });
          draftSave = null;
        }
      })();
      return draftSave;
    },
    discardDraft: () => {
      rememberDraft(get().draftKey, null);
      creationId = null;
      set({ draftBudget: null, draftKey: null, draftDirty: false });
    },
    deleteBudget: async (id) => {
      const uid = sessionUid();
      if (!uid) throw new Error('Inicia sesión para continuar.');
      const revision = sessionRevision();
      await queue.cancel(`${uid}/${id}`);
      await deleteBudgetDoc(uid, id);
      if (isSessionCurrent(uid, revision))
        set((s) => ({
          budgets: s.budgets.filter((b) => b.id !== id),
          activeBudgetId: s.activeBudgetId === id ? null : s.activeBudgetId,
        }));
    },
    setActiveBudget: (id) => set({ activeBudgetId: id }),
    getBudgetTotal: (id) => {
      const b = get().budgets.find((b) => b.id === id);
      return b ? budgetTotals(b).total : 0;
    },
    getWorkItemSubtotal: (id) => {
      const b = active(get());
      const wi = b?.workItems.find((wi) => wi.id === id);
      return wi ? workItemAmount(wi, b?.adjustment?.multiplier) : 0;
    },
    getRawSubtotal: () => totals().raw,
    getSubtotal: () => totals().subtotal,
    getIva: () => totals().iva,
    getTotal: () => totals().total,
    getTaskAmount: (task) => taskAmount(task, active(get())?.adjustment?.multiplier),
    updateInfo: (info) => edit((b) => ({ ...b, info: { ...b.info, ...info } })),
    addWorkItem: (name, catalogPartId) =>
      edit((b) => ({
        ...b,
        workItems: [
          ...b.workItems,
          {
            id: generateId(),
            name,
            ...(catalogPartId ? { catalogPartId } : {}),
            tasks: [emptyTask()],
          },
        ],
      })),
    appendStructure: (items, expected) => {
      if (active(get()) !== expected || get().savingDraft || !sessionUid())
        throw new Error('El presupuesto ha cambiado. Vuelve a revisar la estructura.');
      if (!items.length || items.some((item) => !item.name.trim() || !item.tasks.length))
        throw new Error('Selecciona al menos un concepto.');
      const additions = items.map((item) => ({
        ...item,
        id: generateId(),
        tasks: item.tasks.map((task) => ({ ...task, id: generateId() })),
      }));
      edit((b) => ({ ...b, workItems: [...b.workItems, ...additions] }));
    },
    removeWorkItem: (id) =>
      edit((b) => ({ ...b, workItems: b.workItems.filter((wi) => wi.id !== id) })),
    renameWorkItem: (id, name) => modifyItem(id, (wi) => ({ ...wi, name })),
    addTask: (id) => modifyItem(id, (wi) => ({ ...wi, tasks: [...wi.tasks, emptyTask()] })),
    removeTask: (workItemId, id) =>
      modifyItem(workItemId, (wi) => ({ ...wi, tasks: wi.tasks.filter((t) => t.id !== id) })),
    updateTask: (workItemId, id, patch) =>
      modifyItem(workItemId, (wi) => ({
        ...wi,
        tasks: wi.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    applyTariff: (
      workItemId,
      id,
      catalogPartId,
      catalogConceptId,
      description,
      unit,
      price,
      cost,
    ) => {
      modifyItem(workItemId, (workItem) => ({
        ...workItem,
        catalogPartId,
        tasks: workItem.tasks.map((task) =>
          task.id === id ? { ...task, catalogConceptId, description, unit, price, cost } : task,
        ),
      }));
    },
    updateAdjustment: (adjustment) => edit((b) => ({ ...b, adjustment })),
    updateIvaRate: (rate) => edit((b) => ({ ...b, ivaRate: rate })),
    setBudgetCatalog: (id) => edit((b) => ({ ...b, catalogId: id })),
    resetBudget: () => edit((b) => ({ ...b, info: newDraft().info, workItems: [] })),
  };
});
export function useActiveBudget() {
  return useBudgetStore((s) => active(s));
}

import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({
  fetchBudgets: vi.fn(),
  saveBudget: vi.fn(),
  createBudget: vi.fn(),
  deleteBudgetDoc: vi.fn(),
}));
vi.mock('../src/entities/budget/api/firestore', () => api);
vi.mock('../src/entities/user/api/firestore', () => ({}));
import {
  useBudgetStore as store,
  resetBudgetStore,
  flushBudgetWrites,
} from '../src/entities/budget/model/store';
import { useUserStore } from '../src/entities/user/model/store';
import { setSessionUid } from '../src/shared/model/session';
import { budget, user } from './fixtures';
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  setSessionUid('alice');
  resetBudgetStore();
  useUserStore.setState({ userData: user(), loaded: true });
  api.fetchBudgets.mockResolvedValue([budget()]);
  api.saveBudget.mockResolvedValue(undefined);
  api.deleteBudgetDoc.mockResolvedValue(undefined);
  api.createBudget.mockResolvedValue({ ...user(), totalBudgetsCreated: 1 });
});
afterEach(() => {
  resetBudgetStore();
  vi.useRealTimers();
});
it('preserves an active draft when a list load completes', async () => {
  store.getState().startDraft();
  store.getState().updateInfo({ clientName: 'Pending work' });
  await store.getState().loadBudgets('alice');
  expect(store.getState().draftBudget?.info.clientName).toBe('Pending work');
});
it('deduplicates concurrent draft saves and keeps incomplete rows instead of silently dropping them', async () => {
  store.getState().startDraft();
  store.getState().addWorkItem('Pintura');
  const ids = await Promise.all([store.getState().saveDraft(), store.getState().saveDraft()]);
  expect(ids[0]).toBe(ids[1]);
  expect(api.createBudget).toHaveBeenCalledTimes(1);
  expect(api.createBudget.mock.calls[0]![1].workItems[0].tasks).toHaveLength(1);
});
it('saves both edited budgets and never resurrects a deleted document', async () => {
  store.setState({ budgets: [budget('a'), budget('b')], activeBudgetId: 'a' });
  store.getState().updateInfo({ clientName: 'A' });
  store.getState().setActiveBudget('b');
  store.getState().updateInfo({ clientName: 'B' });
  await flushBudgetWrites();
  expect(api.saveBudget.mock.calls.map((c) => c[1].id)).toEqual(['a', 'b']);
  store.getState().updateInfo({ clientName: 'B2' });
  await store.getState().deleteBudget('b');
  await vi.advanceTimersByTimeAsync(1000);
  expect(api.saveBudget).toHaveBeenCalledTimes(2);
  expect(api.deleteBudgetDoc).toHaveBeenCalledWith('alice', 'b');
});
it('ignores a previous user response after the session changes', async () => {
  let resolve!: (value: unknown) => void;
  api.fetchBudgets.mockImplementation(() => new Promise((r) => (resolve = r)));
  const loading = store.getState().loadBudgets('alice');
  setSessionUid('bob');
  resetBudgetStore();
  resolve([budget()]);
  await loading;
  expect(store.getState().budgets).toEqual([]);
});
it('retains IVA when a template becomes a draft', () => {
  store.getState().startDraftFromTemplate({
    id: 'tpl',
    name: 'Base',
    workItems: budget().workItems,
    ivaRate: 0.21,
    createdAt: '',
  });
  expect(store.getState().draftBudget?.ivaRate).toBe(0.21);
  expect(store.getState().draftBudget?.workItems[0]?.id).not.toBe('work');
});
it('appends a reviewed structure atomically, assigns fresh IDs, and rejects stale or repeated confirmations', () => {
  store.getState().startDraft();
  store.getState().updateIvaRate(0.21);
  const snapshot = store.getState().draftBudget!;
  const items = [
    {
      id: 'source',
      name: 'Pintura',
      catalogPartId: 'part-pintura',
      tasks: [
        {
          id: 'source-task',
          catalogConceptId: 'concept-pintura',
          description: 'Pintura',
          quantity: 0,
          unit: 'm2' as const,
          price: 12,
          cost: 6,
        },
      ],
    },
  ];
  store.getState().appendStructure(items, snapshot);
  const next = store.getState().draftBudget!;
  expect(next.workItems).toHaveLength(1);
  expect(next.workItems[0]?.id).not.toBe('source');
  expect(next.workItems[0]?.catalogPartId).toBe('part-pintura');
  expect(next.workItems[0]?.tasks[0]?.catalogConceptId).toBe('concept-pintura');
  expect(next.workItems[0]?.tasks[0]?.quantity).toBe(0);
  expect(next.ivaRate).toBe(0.21);
  expect(() => store.getState().appendStructure(items, snapshot)).toThrow();
  expect(store.getState().draftBudget?.workItems).toHaveLength(1);
});

it('keeps the selected catalog part and concept IDs on an editable budget snapshot', () => {
  store.getState().startDraft();
  store.getState().addWorkItem('Pintura', 'part-pintura');
  const part = store.getState().draftBudget!.workItems[0]!;
  const line = part.tasks[0]!;
  store
    .getState()
    .applyTariff(
      part.id,
      line.id,
      'part-pintura',
      'concept-paint',
      'Pintura interior',
      'm2',
      18,
      8,
    );

  const snapshot = store.getState().draftBudget!.workItems[0]!;
  expect(snapshot.catalogPartId).toBe('part-pintura');
  expect(snapshot.tasks[0]).toMatchObject({
    catalogConceptId: 'concept-paint',
    description: 'Pintura interior',
    price: 18,
  });
  store.getState().updateTask(snapshot.id, snapshot.tasks[0]!.id, { description: 'Ajuste manual' });
  expect(store.getState().draftBudget!.workItems[0]!.tasks[0]).toMatchObject({
    catalogConceptId: 'concept-paint',
    description: 'Ajuste manual',
  });
});

it('keeps a budget snapshot editable after its catalog part has been removed', async () => {
  const snapshot = {
    ...budget('orphaned-source'),
    workItems: [
      {
        id: 'snapshot-part',
        name: 'Pintura histórica',
        catalogPartId: 'removed-part',
        tasks: [
          {
            id: 'snapshot-concept',
            catalogConceptId: 'removed-concept',
            description: 'Acabado guardado',
            quantity: 3,
            unit: 'm2' as const,
            price: 18,
            cost: 8,
          },
        ],
      },
    ],
  };
  api.fetchBudgets.mockResolvedValue([snapshot]);
  await store.getState().loadBudgets('alice');
  store.getState().setActiveBudget('orphaned-source');
  store.getState().updateTask('snapshot-part', 'snapshot-concept', { quantity: 4 });
  await flushBudgetWrites();
  expect(api.saveBudget.mock.calls[0]?.[1].workItems[0]).toMatchObject({
    catalogPartId: 'removed-part',
    name: 'Pintura histórica',
    tasks: [{ catalogConceptId: 'removed-concept', quantity: 4, description: 'Acabado guardado' }],
  });
});

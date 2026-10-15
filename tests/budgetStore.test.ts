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

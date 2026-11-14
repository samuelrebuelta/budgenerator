import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({
  fetchBudgets: vi.fn(),
  fetchBudget: vi.fn(),
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
import { budgetView, type BudgetRecord } from '../src/entities/budget/model/record';
import { RevisionConflictError } from '../src/entities/construction-document/api/storage';
import {
  addChapter,
  addCatalogConcept,
  createEmptyDocument,
  documentTotals,
  listItemNodes,
} from '../src/entities/construction-document/model';
import { useUserStore } from '../src/entities/user/model/store';
import { setSessionUid } from '../src/shared/model/session';
import { budgetRecord, sampleDocument, user } from './fixtures';

const draftView = () => budgetView(store.getState().draft!);
const activeView = () => budgetView(store.getState().records.find((r) => r.id === 'a')!);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  setSessionUid('alice');
  resetBudgetStore();
  useUserStore.setState({ userData: user(), loaded: true });
  api.fetchBudgets.mockResolvedValue([budgetRecord()]);
  api.saveBudget.mockImplementation(async (_uid, _record, expected: number) => expected + 1);
  api.deleteBudgetDoc.mockResolvedValue(undefined);
  api.createBudget.mockImplementation(async (_uid: string, record: BudgetRecord) => ({
    userData: { ...user(), totalBudgetsCreated: 1 },
    record: {
      ...record,
      revision: 1,
      number: 1,
      document: {
        ...record.document,
        business: { ...record.document.business, budgetNumber: '1' },
      },
    },
  }));
});
afterEach(() => {
  resetBudgetStore();
  vi.useRealTimers();
});

it('preserves an active draft when a list load completes', async () => {
  store.getState().startDraft();
  store.getState().updateInfo({ clientName: 'Pending work' });
  await store.getState().loadBudgets('alice');
  expect(draftView().info.clientName).toBe('Pending work');
});

it('creates drafts as canonical documents and keeps the simple add flow', () => {
  store.getState().startDraft();
  const chapterId = store.getState().addWorkItem('Pintura')!;
  const task = draftView().workItems[0]!.tasks[0]!;
  store.getState().updateTask(chapterId, task.id, {
    description: 'Pintura plástica',
    quantity: 12.5,
    unit: 'm2',
    price: 8.4,
  });
  const document = store.getState().draft!.document;
  expect(document.kind).toBe('budget');
  const concept = document.concepts[listItemNodes(document)[0]!.conceptId]!;
  expect(concept).toMatchObject({ summary: 'Pintura plástica', unit: 'm2', prices: ['8.4'] });
  expect(concept.code).toMatch(/^P\d{4}$/);
  expect(document.concepts[document.tree[0]!.conceptId]!.code).toMatch(/^C\d{2}#$/);
  expect(documentTotals(document).raw).toBe(105);
});

it('accepts free units and rejects negative amounts without changing the document', () => {
  store.getState().startDraft();
  const chapterId = store.getState().addWorkItem('Varios')!;
  const task = draftView().workItems[0]!.tasks[0]!;
  store.getState().updateTask(chapterId, task.id, { unit: 'kg' });
  expect(draftView().workItems[0]!.tasks[0]!.unit).toBe('kg');
  const before = store.getState().draft;
  expect(() => store.getState().updateTask(chapterId, task.id, { price: -1 })).toThrow();
  expect(store.getState().draft).toBe(before);
});

it('deduplicates concurrent draft saves and assigns the server number', async () => {
  store.getState().startDraft();
  store.getState().addWorkItem('Pintura');
  const ids = await Promise.all([store.getState().saveDraft(), store.getState().saveDraft()]);
  expect(ids[0]).toBe(ids[1]);
  expect(api.createBudget).toHaveBeenCalledTimes(1);
  const created = store.getState().records.find((record) => record.id === ids[0])!;
  expect(created.revision).toBe(1);
  expect(budgetView(created).info.budgetNumber).toBe('1');
});

it('saves both edited budgets with their revision and never resurrects a deleted one', async () => {
  store.setState({
    records: [budgetRecord('a'), budgetRecord('b', { revision: 4 })],
    activeBudgetId: 'a',
  });
  store.getState().updateInfo({ clientName: 'A' });
  store.getState().setActiveBudget('b');
  store.getState().updateInfo({ clientName: 'B' });
  await flushBudgetWrites();
  expect(api.saveBudget.mock.calls.map((c) => [c[1].id, c[2]])).toEqual([
    ['a', 1],
    ['b', 4],
  ]);
  expect(store.getState().records.map((record) => record.revision)).toEqual([2, 5]);
  store.getState().updateInfo({ clientName: 'B2' });
  await flushBudgetWrites();
  expect(api.saveBudget.mock.calls[2]![2]).toBe(5);
  store.getState().updateInfo({ clientName: 'B3' });
  await store.getState().deleteBudget('b');
  await vi.advanceTimersByTimeAsync(1000);
  expect(api.saveBudget).toHaveBeenCalledTimes(3);
  expect(api.deleteBudgetDoc).toHaveBeenCalledWith('alice', 'b');
});

it('flags a revision conflict and lets the user reload or keep local changes', async () => {
  store.setState({ records: [budgetRecord('a')], activeBudgetId: 'a' });
  api.saveBudget.mockRejectedValueOnce(new RevisionConflictError());
  store.getState().updateInfo({ clientName: 'Local' });
  await expect(flushBudgetWrites()).rejects.toBeInstanceOf(RevisionConflictError);
  expect(store.getState().conflicts).toEqual(['a']);

  api.fetchBudget.mockResolvedValue(budgetRecord('a', { revision: 7 }));
  await store.getState().overwriteBudget('a');
  expect(api.saveBudget.mock.calls.at(-1)![2]).toBe(7);
  expect(store.getState().conflicts).toEqual([]);
  expect(activeView().info.clientName).toBe('Local');

  api.saveBudget.mockRejectedValueOnce(new RevisionConflictError());
  store.getState().updateInfo({ clientName: 'Otra' });
  await expect(flushBudgetWrites()).rejects.toBeInstanceOf(RevisionConflictError);
  await store.getState().reloadBudget('a');
  expect(activeView().info.clientName).toBe('Estudio de prueba');
  expect(store.getState().conflicts).toEqual([]);
});

it('ignores a previous user response after the session changes', async () => {
  let resolve!: (value: unknown) => void;
  api.fetchBudgets.mockImplementation(() => new Promise((r) => (resolve = r)));
  const loading = store.getState().loadBudgets('alice');
  setSessionUid('bob');
  resetBudgetStore();
  resolve([budgetRecord()]);
  await loading;
  expect(store.getState().records).toEqual([]);
});

it('retains IVA when a template becomes a draft and keeps its FIEBDC content', () => {
  const template = sampleDocument('template', { name: 'Base', ivaRate: 0.21 });
  store.getState().startDraftFromTemplate({ id: 'tpl', createdAt: '', document: template });
  const draft = store.getState().draft!;
  expect(draft.document.kind).toBe('budget');
  expect(draft.document.business.ivaRate).toBe(0.21);
  expect(draftView().workItems[0]!.tasks[0]).toMatchObject({ description: 'Pintura de paredes' });
  expect(draft.document.concepts[draft.document.rootConceptId]!.code).toBe('PRESUPUESTO##');
});

it('opens an imported BC3 document as a dirty draft without consuming quota', () => {
  const imported = sampleDocument('budget', { address: 'Obra importada' });
  store.getState().startDraftFromDocument(imported);
  expect(store.getState().draftDirty).toBe(true);
  expect(draftView().info.address).toBe('Obra importada');
  expect(api.createBudget).not.toHaveBeenCalled();
});

it('appends a reviewed structure atomically and rejects stale or repeated confirmations', () => {
  let catalog = createEmptyDocument('catalog', { name: 'Catálogo' });
  const chapter = addChapter(catalog, 'Pintura');
  const added = addCatalogConcept(chapter.document, chapter.chapterId, {
    description: 'Pintura',
    unit: 'm2',
    price: 12,
    cost: 6,
  });
  catalog = added.document;
  store.getState().startDraft();
  store.getState().updateIvaRate(0.21);
  const snapshot = draftView();
  const chapters = [
    {
      name: 'Pintura',
      catalogChapterId: chapter.chapterId,
      items: [{ catalogConceptId: added.conceptId, description: 'Pintura', quantity: 0 }],
    },
  ];
  store.getState().appendStructure(chapters, snapshot, catalog);
  const next = draftView();
  expect(next.workItems).toHaveLength(1);
  expect(next.workItems[0]?.catalogPartId).toBe(chapter.chapterId);
  expect(next.workItems[0]?.tasks[0]).toMatchObject({
    catalogConceptId: added.conceptId,
    quantity: 0,
    price: 12,
    cost: 6,
  });
  expect(next.ivaRate).toBe(0.21);
  expect(() => store.getState().appendStructure(chapters, snapshot, catalog)).toThrow();
  expect(draftView().workItems).toHaveLength(1);
});

it('copies a catalog concept with its decomposition and keeps it after the catalog changes', async () => {
  let catalog = createEmptyDocument('catalog');
  const chapter = addChapter(catalog, 'Pintura');
  const added = addCatalogConcept(chapter.document, chapter.chapterId, {
    description: 'Pintura interior',
    unit: 'm2',
    price: 18,
    cost: 8,
  });
  catalog = added.document;
  store.setState({ records: [budgetRecord('a')], activeBudgetId: 'a' });
  const task = activeView().workItems[0]!.tasks[0]!;
  store.getState().applyCatalogConcept(task.id, catalog, added.conceptId, chapter.chapterId);
  expect(activeView().workItems[0]!.tasks[0]).toMatchObject({
    catalogConceptId: added.conceptId,
    description: 'Pintura interior',
    price: 18,
    quantity: 2.5,
  });
  store.getState().updateTask('x', task.id, { description: 'Ajuste manual' });
  await flushBudgetWrites();
  const saved = api.saveBudget.mock.calls.at(-1)![1] as BudgetRecord;
  expect(budgetView(saved).workItems[0]!.tasks[0]).toMatchObject({
    catalogConceptId: added.conceptId,
    description: 'Ajuste manual',
  });
});

it('keeps measurement lines as the source of the quantity', () => {
  store.setState({ records: [budgetRecord('a')], activeBudgetId: 'a' });
  const task = activeView().workItems[0]!.tasks[0]!;
  store.getState().setTaskMeasurements(task.id, [
    { type: '', comment: 'Pared', units: '2', length: '3', height: '2.5' },
    { type: '', comment: 'Hueco', units: '-1', length: '0.8', height: '2' },
  ]);
  expect(activeView().workItems[0]!.tasks[0]).toMatchObject({ quantity: 13.4, measured: true });
  expect(() => store.getState().updateTask('x', task.id, { quantity: 3 })).toThrow();
  store.getState().setTaskMeasurements(task.id, []);
  expect(activeView().workItems[0]!.tasks[0]).toMatchObject({ quantity: 13.4, measured: false });
});

it('blocks edits on accepted budgets', () => {
  store.setState({
    records: [budgetRecord('a', { acceptedAt: '2026-10-18T09:00:00Z' })],
    activeBudgetId: 'a',
  });
  store.getState().updateInfo({ clientName: 'Cambio' });
  expect(activeView().info.clientName).toBe('Estudio de prueba');
});

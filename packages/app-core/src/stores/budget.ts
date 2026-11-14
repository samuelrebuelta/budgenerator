import { createStore } from 'zustand/vanilla';
import type { Budget, BudgetAdjustment, BudgetInfo, UserData } from '@bg/domain/types';
import { generateId } from '@bg/domain/lib/utils';
import {
  ROOT_CHAPTER_ID,
  addChapter,
  addItem,
  appendChapters,
  applyCatalogConcept,
  cloneAsKind,
  createEmptyDocument,
  documentTotals,
  emptyBusiness,
  flattenItemPrice,
  removeNode,
  renameChapter,
  setMeasurementLines,
  updateBusiness,
  updateItem,
  validateConstructionContent,
  type ChapterInput,
  type ConstructionContent,
  type ConstructionDocument,
  type FiebdcMeasurementLine,
  type ItemInput,
} from '@bg/domain/construction-document';
import { assertPublishable, budgetView, type BudgetRecord } from '@bg/domain/budget/record';
import type { BudgetAcceptanceRepository, BudgetRepository } from '@bg/firebase-api/budget';
import { RevisionConflictError, RevisionTracker } from '@bg/firebase-api/storedDocument';
import type { DraftStorage } from '../ports.js';
import { WriteQueue } from '../writeQueue.js';
import { isSessionCurrent, sessionRevision, sessionUid } from '../session.js';
import { registerFlusher } from '../sync.js';
import { registerOfflineStore } from '../offlineStateCache.js';

/** Prefix of the unsaved drafts in `DraftStorage`: `cimbra-draft:{uid}:{draftKey}`. */
export const DRAFT_KEY_PREFIX = 'cimbra-draft';

export interface TemplateSource {
  id: string;
  createdAt: string;
  document: ConstructionDocument;
}

export interface BudgetState {
  records: BudgetRecord[];
  activeBudgetId: string | null;
  draft: BudgetRecord | null;
  loaded: boolean;
  draftKey: string | null;
  draftDirty: boolean;
  savingDraft: boolean;
  /** Budget IDs whose last save was rejected because another client saved first. */
  conflicts: string[];
  loadBudgets: (uid: string) => Promise<void>;
  startDraft: () => void;
  startDraftFromLead: (lead: { id: string; contact: { name: string } }) => void;
  startDraftFromTemplate: (template: TemplateSource) => void;
  startDraftFromBudget: (id: string) => void;
  /** Opens a draft from an imported BC3 document (preview already confirmed). */
  startDraftFromDocument: (document: ConstructionDocument) => void;
  acceptBudget: (id: string) => Promise<void>;
  withdrawBudgetAcceptance: (id: string) => Promise<void>;
  linkProject: (id: string, projectId: string, revision?: number) => void;
  syncLinkedProjectMetadata: (
    id: string,
    metadata: Pick<BudgetInfo, 'address' | 'clientName'>,
    revision?: number,
  ) => void;
  loadTemplateForEditing: (template: TemplateSource | null) => void;
  saveDraft: () => Promise<string>;
  discardDraft: () => void;
  deleteBudget: (id: string) => Promise<void>;
  setActiveBudget: (id: string | null) => void;
  reloadBudget: (id: string) => Promise<void>;
  overwriteBudget: (id: string) => Promise<void>;
  getBudgetTotal: (id: string) => number;
  getWorkItemSubtotal: (id: string) => number;
  getRawSubtotal: () => number;
  getSubtotal: () => number;
  getIva: () => number;
  getTotal: () => number;
  getTaskAmount: (taskId: string) => number;
  updateInfo: (info: Partial<BudgetInfo>) => void;
  addWorkItem: (name: string, catalogPartId?: string) => string | null;
  appendStructure: (
    chapters: ChapterInput[],
    expected: Budget,
    catalog?: ConstructionContent,
  ) => void;
  removeWorkItem: (id: string) => void;
  renameWorkItem: (id: string, name: string) => void;
  addTask: (workItemId: string, input?: ItemInput) => string | null;
  removeTask: (workItemId: string, id: string) => void;
  updateTask: (workItemId: string, id: string, patch: ItemInput) => void;
  setTaskMeasurements: (id: string, lines: FiebdcMeasurementLine[]) => void;
  setDirectTaskPrice: (id: string) => void;
  applyCatalogConcept: (
    taskId: string,
    catalog: ConstructionContent,
    catalogConceptId: string,
    catalogPartId?: string,
  ) => void;
  updateAdjustment: (value: BudgetAdjustment | undefined) => void;
  updateIvaRate: (rate: number) => void;
  resetBudget: () => void;
}

/** The draft being edited or the active saved budget. */
export const activeRecord = (s: Pick<BudgetState, 'draft' | 'records' | 'activeBudgetId'>) =>
  s.draft ?? s.records.find((b) => b.id === s.activeBudgetId);

export interface BudgetStoreOptions {
  repository: Pick<
    BudgetRepository,
    'fetchBudgets' | 'fetchBudget' | 'saveBudget' | 'createBudget' | 'deleteBudgetDoc'
  >;
  /** Loaded on first use (the web keeps it out of the initial chunk). */
  acceptance: () => Promise<
    Pick<BudgetAcceptanceRepository, 'acceptBudget' | 'withdrawBudgetAcceptance'>
  >;
  /** Quota and account counters of the user store. */
  user: { canCreateBudget(): boolean; setUserData(userData: UserData): void };
  /** Unsaved drafts (web: `sessionStorage`, mobile: MMKV of the UID). */
  drafts: DraftStorage;
}

const today = () => new Date().toLocaleDateString('en-CA');

function draftRecord(
  document: ConstructionDocument,
  patch: Partial<BudgetRecord> = {},
): BudgetRecord {
  return { id: '', revision: 0, number: 0, createdAt: '', updatedAt: '', document, ...patch };
}

function newBudgetDocument(patch: Parameters<typeof emptyBusiness>[0] = {}) {
  return createEmptyDocument('budget', { date: today(), ...patch });
}

/** Budgets, the draft editor (also for templates) and their debounced saves. */
export function createBudgetStore({ repository, acceptance, user, drafts }: BudgetStoreOptions) {
  function draftStorage(key: string) {
    return `${DRAFT_KEY_PREFIX}:${sessionUid()}:${key}`;
  }
  function rememberDraft(key: string | null, record: BudgetRecord | null) {
    if (!key) return;
    try {
      if (record) drafts.setItem(draftStorage(key), JSON.stringify(record));
      else drafts.removeItem(draftStorage(key));
    } catch {
      /* Storage can be unavailable in private mode. */
    }
  }
  function recoverDraft(key: string, fallback: BudgetRecord): BudgetRecord {
    try {
      const raw = drafts.getItem(draftStorage(key));
      if (raw) {
        const parsed = JSON.parse(raw) as BudgetRecord;
        if (
          parsed?.document?.kind === fallback.document.kind &&
          !validateConstructionContent(parsed.document).length &&
          documentTotals(parsed.document).valid
        )
          return parsed;
      }
    } catch {
      /* Keep the valid server/default document. */
    }
    return fallback;
  }

  const revisions = new RevisionTracker();
  const queue = new WriteQueue<BudgetRecord>('budget:', async (key, record) => {
    const uid = key.split('/')[0]!;
    const expected = revisions.get(key) ?? record.revision;
    try {
      const revision = await repository.saveBudget(uid, record, expected);
      revisions.set(key, revision);
      if (isSessionCurrent(uid, sessionRevision()))
        store.setState((state) => ({
          records: state.records.map((item) =>
            item.id === record.id ? { ...item, revision } : item,
          ),
          conflicts: state.conflicts.filter((id) => id !== record.id),
        }));
    } catch (error) {
      if (error instanceof RevisionConflictError)
        store.setState((state) => ({
          conflicts: [...new Set([...state.conflicts, record.id])],
        }));
      throw error;
    }
  });
  const getAcceptanceApi = acceptance;
  let draftSave: Promise<string> | null = null;
  let creationId: string | null = null;
  registerFlusher(async () => {
    await draftSave;
  });
  function clearBudgetWrites() {
    queue.clear();
    revisions.clear();
    creationId = null;
    draftSave = null;
  }
  const initial = {
    records: [] as BudgetRecord[],
    activeBudgetId: null as string | null,
    draft: null as BudgetRecord | null,
    draftKey: null as string | null,
    loaded: false,
    draftDirty: false,
    savingDraft: false,
    conflicts: [] as string[],
  };
  const store = createStore<BudgetState>()((set, get) => {
    const edit = (updater: (document: ConstructionDocument) => ConstructionDocument) => {
      if (get().savingDraft) return;
      const current = activeRecord(get());
      if (!current || current.acceptedAt || current.projectId) return;
      const document = updater(current.document);
      if (document === current.document) return;
      const totals = documentTotals(document);
      if (!totals.valid) throw new Error(totals.issues[0]?.message ?? 'Revisa el presupuesto.');
      const next = { ...current, document };
      if (get().draft) {
        set({ draft: next, draftDirty: true });
        rememberDraft(get().draftKey, next);
      } else {
        set((s) => ({ records: s.records.map((b) => (b.id === next.id ? next : b)) }));
        const uid = sessionUid();
        if (uid) {
          const key = `${uid}/${next.id}`;
          if (revisions.get(key) === undefined) revisions.set(key, current.revision);
          queue.schedule(key, next);
        }
      }
    };
    const totals = () => {
      const record = activeRecord(get());
      return record
        ? documentTotals(record.document)
        : { raw: 0, subtotal: 0, iva: 0, total: 0, nodes: new Map() };
    };
    const openDraft = (key: string, record: BudgetRecord) => {
      creationId = null;
      const restored = recoverDraft(key, record);
      set({
        draft: restored,
        draftKey: key,
        draftDirty:
          JSON.stringify(restored) !== JSON.stringify(record) ||
          (key === 'budget' && record.document.tree.length > 0),
        activeBudgetId: null,
      });
      rememberDraft(key, restored);
    };
    const applyRemote = (id: string, patch: Partial<BudgetRecord>) =>
      set((state) => ({
        records: state.records.map((record) =>
          record.id === id ? { ...record, ...patch } : record,
        ),
      }));
    return {
      ...initial,
      loadBudgets: async (uid) => {
        const revision = sessionRevision();
        const records = await repository.fetchBudgets(uid);
        if (!isSessionCurrent(uid, revision)) return;
        for (const record of records) revisions.set(`${uid}/${record.id}`, record.revision);
        set({
          records: records.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          loaded: true,
        });
      },
      startDraft: () => {
        if (!get().draft || get().draftKey !== 'budget')
          openDraft('budget', draftRecord(newBudgetDocument()));
      },
      startDraftFromLead: (lead) => {
        const key = `budget:lead:${lead.id}`;
        if (get().draft && get().draftKey === key) return;
        openDraft(
          key,
          draftRecord(newBudgetDocument({ clientName: lead.contact.name }), {
            sourceLeadId: lead.id,
          }),
        );
      },
      startDraftFromTemplate: (template) => {
        const { business } = template.document;
        const document = cloneAsKind(
          template.document,
          'budget',
          emptyBusiness({
            date: today(),
            ivaRate: business.ivaRate,
            ...(business.adjustment ? { adjustment: { ...business.adjustment } } : {}),
          }),
        );
        rememberDraft('budget', null);
        openDraft('budget', draftRecord(document));
      },
      startDraftFromBudget: (id) => {
        const source = get().records.find((budget) => budget.id === id);
        if (!source) throw new Error('No se ha encontrado el presupuesto.');
        const document = cloneAsKind(source.document, 'budget', {
          ...source.document.business,
          date: today(),
          budgetNumber: '',
        });
        rememberDraft('budget', null);
        openDraft('budget', draftRecord(document));
      },
      startDraftFromDocument: (document) => {
        if (document.kind !== 'budget') throw new Error('El documento no es un presupuesto.');
        rememberDraft('budget', null);
        openDraft('budget', draftRecord(structuredClone(document)));
        set({ draftDirty: true });
      },
      acceptBudget: async (id) => {
        const uid = sessionUid();
        if (!uid) throw new Error('Inicia sesión para continuar.');
        await queue.flush();
        const source = get().records.find((budget) => budget.id === id);
        if (!source) throw new Error('No se ha encontrado el presupuesto.');
        if (get().conflicts.includes(id)) throw new RevisionConflictError();
        assertPublishable(source);
        const acceptedAt = source.acceptedAt ?? new Date().toISOString();
        const session = sessionRevision();
        const key = `${uid}/${id}`;
        const revision = await (
          await getAcceptanceApi()
        ).acceptBudget(uid, id, acceptedAt, revisions.get(key) ?? source.revision);
        revisions.set(key, revision);
        if (isSessionCurrent(uid, session)) applyRemote(id, { acceptedAt, revision });
      },
      withdrawBudgetAcceptance: async (id) => {
        const uid = sessionUid();
        if (!uid) throw new Error('Inicia sesión para continuar.');
        const session = sessionRevision();
        const revision = await (await getAcceptanceApi()).withdrawBudgetAcceptance(uid, id);
        revisions.set(`${uid}/${id}`, revision);
        if (isSessionCurrent(uid, session))
          set((state) => ({
            records: state.records.map((budget) => {
              if (budget.id !== id) return budget;
              const updated = { ...budget, revision };
              delete updated.acceptedAt;
              return updated;
            }),
          }));
      },
      linkProject: (id, projectId, revision) => {
        const uid = sessionUid();
        if (uid && revision) revisions.set(`${uid}/${id}`, revision);
        applyRemote(id, { projectId, ...(revision ? { revision } : {}) });
      },
      syncLinkedProjectMetadata: (id, metadata, revision) => {
        const uid = sessionUid();
        if (uid && revision) revisions.set(`${uid}/${id}`, revision);
        set((state) => ({
          records: state.records.map((budget) =>
            budget.id === id && budget.projectId
              ? {
                  ...budget,
                  ...(revision ? { revision } : {}),
                  document: {
                    ...budget.document,
                    business: { ...budget.document.business, ...metadata },
                  },
                }
              : budget,
          ),
        }));
      },
      loadTemplateForEditing: (template) =>
        openDraft(
          `template:${template?.id || 'new'}`,
          draftRecord(
            template ? structuredClone(template.document) : createEmptyDocument('template'),
            template ? { id: template.id, createdAt: template.createdAt } : {},
          ),
        ),
      saveDraft: () => {
        if (draftSave) return draftSave;
        const draft = get().draft;
        const uid = sessionUid();
        const key = get().draftKey;
        if (!draft || !uid || (key !== 'budget' && !key?.startsWith('budget:lead:')))
          return Promise.resolve('');
        if (!user.canCreateBudget())
          return Promise.reject(new Error('Has alcanzado el límite de tu plan.'));
        creationId ??= generateId();
        const pending = { ...draft, id: creationId };
        const session = sessionRevision();
        set({ savingDraft: true });
        draftSave = (async () => {
          try {
            const { userData, record } = await repository.createBudget(uid, pending);
            if (isSessionCurrent(uid, session)) {
              revisions.set(`${uid}/${record.id}`, record.revision);
              user.setUserData(userData);
              rememberDraft(get().draftKey, null);
              set((s) => ({
                records: [...s.records.filter((b) => b.id !== record.id), record],
                activeBudgetId: record.id,
                draft: null,
                draftKey: null,
                draftDirty: false,
              }));
              creationId = null;
            }
            return record.id;
          } finally {
            if (isSessionCurrent(uid, session)) set({ savingDraft: false });
            draftSave = null;
          }
        })();
        return draftSave;
      },
      discardDraft: () => {
        rememberDraft(get().draftKey, null);
        creationId = null;
        set({ draft: null, draftKey: null, draftDirty: false });
      },
      deleteBudget: async (id) => {
        const uid = sessionUid();
        if (!uid) throw new Error('Inicia sesión para continuar.');
        const budget = get().records.find((item) => item.id === id);
        if (budget?.projectId)
          throw new Error('El presupuesto convertido se conserva como origen del proyecto.');
        if (budget?.acceptedAt)
          throw new Error('Retira la aceptación antes de eliminar el presupuesto.');
        const session = sessionRevision();
        await queue.cancel(`${uid}/${id}`);
        await repository.deleteBudgetDoc(uid, id);
        revisions.delete(`${uid}/${id}`);
        if (isSessionCurrent(uid, session))
          set((s) => ({
            records: s.records.filter((b) => b.id !== id),
            activeBudgetId: s.activeBudgetId === id ? null : s.activeBudgetId,
            conflicts: s.conflicts.filter((item) => item !== id),
          }));
      },
      setActiveBudget: (id) => set({ activeBudgetId: id }),
      /** Discards local unsaved changes and loads the latest server version. */
      reloadBudget: async (id) => {
        const uid = sessionUid();
        if (!uid) return;
        const session = sessionRevision();
        await queue.cancel(`${uid}/${id}`);
        const fresh = await repository.fetchBudget(uid, id);
        if (!isSessionCurrent(uid, session)) return;
        if (fresh) revisions.set(`${uid}/${id}`, fresh.revision);
        set((state) => ({
          records: fresh
            ? state.records.map((record) => (record.id === id ? fresh : record))
            : state.records.filter((record) => record.id !== id),
          conflicts: state.conflicts.filter((item) => item !== id),
        }));
      },
      /** Keeps the local version and saves it over the newer server version. */
      overwriteBudget: async (id) => {
        const uid = sessionUid();
        if (!uid) return;
        const fresh = await repository.fetchBudget(uid, id);
        const local = get().records.find((record) => record.id === id);
        if (!fresh || !local) return;
        if (fresh.acceptedAt || fresh.projectId)
          throw new Error('La versión guardada está aceptada; recárgala para continuar.');
        const key = `${uid}/${id}`;
        revisions.set(key, fresh.revision);
        set((state) => ({ conflicts: state.conflicts.filter((item) => item !== id) }));
        queue.schedule(key, local);
        await queue.flush();
      },
      getBudgetTotal: (id) => {
        const record = get().records.find((b) => b.id === id);
        return record ? documentTotals(record.document).total : 0;
      },
      getWorkItemSubtotal: (id) => {
        const record = activeRecord(get());
        if (!record) return 0;
        const nodes = documentTotals(record.document).nodes;
        if (id !== ROOT_CHAPTER_ID) return nodes.get(id)?.amount ?? 0;
        return record.document.tree.reduce((sum, node) => {
          const amount = nodes.get(node.id);
          return amount && !amount.chapter ? sum + amount.amount : sum;
        }, 0);
      },
      getRawSubtotal: () => totals().raw,
      getSubtotal: () => totals().subtotal,
      getIva: () => totals().iva,
      getTotal: () => totals().total,
      getTaskAmount: (taskId) => totals().nodes.get(taskId)?.amount ?? 0,
      updateInfo: (info) =>
        edit((document) => {
          const template = document.kind === 'template';
          return updateBusiness(document, {
            ...(info.clientName !== undefined
              ? template
                ? { name: info.clientName }
                : { clientName: info.clientName }
              : {}),
            ...(info.address !== undefined ? { address: info.address } : {}),
            ...(info.date !== undefined ? { date: info.date } : {}),
            ...(info.budgetNumber !== undefined ? { budgetNumber: info.budgetNumber } : {}),
          });
        }),
      addWorkItem: (name, catalogPartId) => {
        let chapterId: string | null = null;
        edit((document) => {
          const added = addChapter(
            document,
            name,
            catalogPartId ? { catalogChapterId: catalogPartId } : {},
          );
          chapterId = added.chapterId;
          return addItem(added.document, added.chapterId).document;
        });
        return chapterId;
      },
      appendStructure: (chapters, expected, catalog) => {
        const current = activeRecord(get());
        if (!current || budgetView(current) !== expected || get().savingDraft || !sessionUid())
          throw new Error('El presupuesto ha cambiado. Vuelve a revisar la estructura.');
        if (!chapters.length || chapters.some((item) => !item.name.trim() || !item.items.length))
          throw new Error('Selecciona al menos una partida.');
        edit((document) => appendChapters(document, chapters, catalog));
      },
      removeWorkItem: (id) =>
        edit((document) =>
          id === ROOT_CHAPTER_ID
            ? document.tree
                .filter((node) => !node.children.length)
                .reduce((doc, node) => {
                  const concept = doc.concepts[node.conceptId];
                  return concept?.code.endsWith('#') ? doc : removeNode(doc, node.id);
                }, document)
            : removeNode(document, id),
        ),
      renameWorkItem: (id, name) => edit((document) => renameChapter(document, id, name)),
      addTask: (workItemId, input) => {
        let nodeId: string | null = null;
        edit((document) => {
          const added = addItem(document, workItemId, input);
          nodeId = added.nodeId;
          return added.document;
        });
        return nodeId;
      },
      removeTask: (_workItemId, id) => edit((document) => removeNode(document, id)),
      updateTask: (_workItemId, id, patch) => edit((document) => updateItem(document, id, patch)),
      setTaskMeasurements: (id, lines) =>
        edit((document) => setMeasurementLines(document, id, lines)),
      setDirectTaskPrice: (id) => edit((document) => flattenItemPrice(document, id)),
      applyCatalogConcept: (taskId, catalog, catalogConceptId, catalogPartId) =>
        edit((document) =>
          applyCatalogConcept(document, taskId, catalog, catalogConceptId, catalogPartId),
        ),
      updateAdjustment: (adjustment) =>
        edit((document) => updateBusiness(document, { adjustment })),
      updateIvaRate: (rate) => edit((document) => updateBusiness(document, { ivaRate: rate })),
      resetBudget: () =>
        edit((document) => {
          const fresh = createEmptyDocument(document.kind, {
            ...emptyBusiness({ date: document.kind === 'budget' ? today() : '' }),
            ivaRate: document.business.ivaRate,
          });
          return fresh;
        }),
    };
  });

  registerOfflineStore('budget-records', store, sessionUid, (state) => ({
    records: state.records,
    activeBudgetId: state.activeBudgetId,
    loaded: state.loaded,
  }));

  return {
    store,
    reset() {
      clearBudgetWrites();
      store.setState(initial);
    },
    clearWrites: clearBudgetWrites,
    flushWrites: () => queue.flush(),
  };
}

import { createStore } from 'zustand/vanilla';
import {
  addCatalogConcept,
  addChapter,
  documentTotals,
  mergeIntoCatalog,
  normalizeText,
  removeCatalogConcept,
  removeNode,
  renameChapter,
  updateCatalogConcept,
  type ConstructionDocument,
  type FiebdcConcept,
} from '@bg/domain/construction-document';
import { BASE_CATALOGS, TRADE_CATALOGS } from '@bg/domain/catalog/baseCatalogs';
import { baseCatalogDocument } from '@bg/domain/catalog/bases';
import type { CatalogRecord } from '@bg/domain/catalog/record';
import type { CatalogRepository } from '@bg/firebase-api/catalog';
import { RevisionConflictError, RevisionTracker } from '@bg/firebase-api/storedDocument';
import { WriteQueue } from '../writeQueue.js';
import { registerOfflineStore } from '../offlineStateCache.js';
import { isBrowserDisconnected } from '../network.js';
import { isSessionCurrent, sessionRevision, sessionUid } from '../session.js';

export type TradeImportScope =
  | { type: 'category' }
  | { type: 'part'; partName: string }
  | { type: 'concept'; partName: string; description: string; unit: string };

export interface TradeImportResult {
  addedParts: number;
  addedConcepts: number;
}

export interface CatalogConceptInput {
  description: string;
  unit: string;
  basePrice: number;
  cost: number;
}

export interface CatalogState {
  record: CatalogRecord | null;
  loaded: boolean;
  conflict: boolean;
  loadCatalogs: (uid: string, force?: boolean) => Promise<void>;
  addPart: (name: string) => string;
  renamePart: (partId: string, name: string) => void;
  removePart: (partId: string) => void;
  addConcept: (partId: string, concept: CatalogConceptInput) => string;
  updateConcept: (partId: string, conceptId: string, updates: Partial<CatalogConceptInput>) => void;
  removeConcept: (partId: string, conceptId: string) => void;
  importTrade: (tradeId: string, scope?: TradeImportScope) => TradeImportResult;
  /** Merges chapters of an imported BC3 price base and saves once. */
  importDocument: (document: ConstructionDocument) => Promise<TradeImportResult>;
  reloadCatalog: () => Promise<void>;
  overwriteCatalog: () => Promise<void>;
}

const seedId = 'reforma_integral';

/** The account catalog with debounced saves and optimistic revisions. */
export function createCatalogStore({
  repository,
}: {
  repository: Pick<CatalogRepository, 'ensureCatalog' | 'fetchCatalog' | 'saveCatalog'>;
}) {
  const revisions = new RevisionTracker();
  const queue = new WriteQueue<CatalogRecord>('catalog:', async (key, record) => {
    const uid = key.split('/')[0]!;
    try {
      const revision = await repository.saveCatalog(
        uid,
        record,
        revisions.get(key) ?? record.revision,
      );
      revisions.set(key, revision);
      if (isSessionCurrent(uid, sessionRevision()))
        store.setState((state) => ({
          record: state.record ? { ...state.record, revision } : state.record,
          conflict: false,
        }));
    } catch (error) {
      if (error instanceof RevisionConflictError) store.setState({ conflict: true });
      throw error;
    }
  });
  const store = createStore<CatalogState>()((set, get) => {
    const editCatalog = (update: (document: ConstructionDocument) => ConstructionDocument) => {
      const uid = sessionUid();
      const current = get().record;
      if (!uid || !current) throw new Error('Espera a que se cargue el catálogo.');
      const document = update(current.document);
      if (document === current.document) return current;
      const totals = documentTotals(document);
      if (!totals.valid) throw new Error('Revisa los precios del catálogo.');
      const next = { ...current, document, updatedAt: new Date().toISOString() };
      set({ record: next });
      const key = `${uid}/${current.id}`;
      if (revisions.get(key) === undefined) revisions.set(key, current.revision);
      queue.schedule(key, next);
      return next;
    };
    const conceptPatch = (updates: Partial<CatalogConceptInput>) => ({
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.unit !== undefined ? { unit: updates.unit } : {}),
      ...(updates.basePrice !== undefined ? { price: updates.basePrice } : {}),
      ...(updates.cost !== undefined ? { cost: updates.cost } : {}),
    });
    return {
      record: null,
      loaded: false,
      conflict: false,
      loadCatalogs: async (uid, force = false) => {
        if (get().loaded && sessionUid() === uid && (!force || isBrowserDisconnected())) return;
        const session = sessionRevision();
        const record = await repository.ensureCatalog(
          uid,
          baseCatalogDocument(BASE_CATALOGS.find((catalog) => catalog.id === seedId)!),
        );
        if (!isSessionCurrent(uid, session)) return;
        revisions.set(`${uid}/${record.id}`, record.revision);
        set({ record, loaded: true });
      },
      addPart: (name) => {
        let chapterId = '';
        editCatalog((document) => {
          const added = addChapter(document, name);
          chapterId = added.chapterId;
          return added.document;
        });
        return chapterId;
      },
      renamePart: (partId, name) => {
        editCatalog((document) => renameChapter(document, partId, name));
      },
      removePart: (partId) => {
        editCatalog((document) => removeNode(document, partId));
      },
      addConcept: (partId, concept) => {
        let conceptId = '';
        editCatalog((document) => {
          const added = addCatalogConcept(document, partId, conceptPatch(concept));
          conceptId = added.conceptId;
          return added.document;
        });
        return conceptId;
      },
      updateConcept: (_partId, conceptId, updates) => {
        editCatalog((document) => updateCatalogConcept(document, conceptId, conceptPatch(updates)));
      },
      removeConcept: (partId, conceptId) => {
        editCatalog((document) => removeCatalogConcept(document, partId, conceptId));
      },
      importTrade: (tradeId, scope = { type: 'category' }) => {
        const trade = TRADE_CATALOGS.find((item) => item.id === tradeId);
        if (!trade) throw new Error('No se encuentra el oficio que quieres importar.');
        if (!get().record) throw new Error('Espera a que se cargue el catálogo.');
        const source = baseCatalogDocument(trade);
        const include = (chapter: string, item?: FiebdcConcept) => {
          if (scope.type === 'category') return true;
          if (normalizeText(chapter) !== normalizeText(scope.partName)) return false;
          if (scope.type === 'part' || !item) return true;
          return (
            item.unit === scope.unit &&
            normalizeText(item.summary) === normalizeText(scope.description)
          );
        };
        let result: TradeImportResult = { addedParts: 0, addedConcepts: 0 };
        editCatalog((document) => {
          const merged = mergeIntoCatalog(document, source, include);
          result = { addedParts: merged.addedParts, addedConcepts: merged.addedConcepts };
          return merged.addedConcepts || merged.addedParts ? merged.document : document;
        });
        return result;
      },
      importDocument: async (source) => {
        const uid = sessionUid();
        if (!uid || !get().record) throw new Error('Espera a que se cargue el catálogo.');
        let result: TradeImportResult = { addedParts: 0, addedConcepts: 0 };
        const previous = get().record!;
        editCatalog((document) => {
          const merged = mergeIntoCatalog(document, source);
          result = { addedParts: merged.addedParts, addedConcepts: merged.addedConcepts };
          return merged.document;
        });
        try {
          await queue.flush();
        } catch (error) {
          if (
            !(error instanceof RevisionConflictError) &&
            isSessionCurrent(uid, sessionRevision())
          ) {
            await queue.cancel(`${uid}/${previous.id}`);
            set({ record: previous });
          }
          throw error;
        }
        return result;
      },
      reloadCatalog: async () => {
        const uid = sessionUid();
        const current = get().record;
        if (!uid || !current) return;
        const session = sessionRevision();
        await queue.cancel(`${uid}/${current.id}`);
        const fresh = await repository.fetchCatalog(uid);
        if (!fresh || !isSessionCurrent(uid, session)) return;
        revisions.set(`${uid}/${fresh.id}`, fresh.revision);
        set({ record: fresh, conflict: false });
      },
      overwriteCatalog: async () => {
        const uid = sessionUid();
        const current = get().record;
        if (!uid || !current) return;
        const fresh = await repository.fetchCatalog(uid);
        if (!fresh) return;
        const key = `${uid}/${current.id}`;
        revisions.set(key, fresh.revision);
        set({ conflict: false });
        queue.schedule(key, current);
        await queue.flush();
      },
    };
  });

  registerOfflineStore('catalog-record', store, sessionUid, (state) => ({
    record: state.record,
    loaded: state.loaded,
  }));

  return {
    store,
    reset() {
      queue.clear();
      revisions.clear();
      store.setState({ record: null, loaded: false, conflict: false });
    },
    flushWrites: () => queue.flush(),
  };
}

import { create } from 'zustand';
import type { CatalogConcept, Tariff, TariffCatalog } from '@/shared/types';
import { generateId } from '@/shared/lib';
import { WriteQueue } from '@/shared/lib/writeQueue';
import { isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import { BASE_CATALOGS, TRADE_CATALOGS } from './baseCatalogs';
import { mergeTradeIntoParts, type TradeImportResult, type TradeImportScope } from './tradeImport';
import { catalogParts, flattenCatalogParts, groupLegacyTariffs, legacyPartId } from './migrate';
import {
  deleteLegacyTariffs,
  deleteTariffCatalogDoc,
  fetchActiveTariffCatalogId,
  fetchLegacyTariffs,
  fetchTariffCatalogs,
  ensureSingleCatalog,
  updateTariffCatalogDoc,
} from '../api/firestore';
interface CatalogState {
  tariffs: Tariff[];
  catalogs: TariffCatalog[];
  loaded: boolean;
  activeCatalogId: string | null;
  loadCatalogs: (uid: string) => Promise<void>;
  addTariff: (tariff: Omit<Tariff, 'id'>, catalogId?: string) => Promise<void>;
  updateTariff: (
    id: string,
    updates: Partial<Omit<Tariff, 'id'>>,
    catalogId?: string,
  ) => Promise<void>;
  removeTariff: (id: string, catalogId?: string) => Promise<void>;
  addPart: (name: string, catalogId?: string) => string;
  importTrade: (tradeId: string, catalogId?: string, scope?: TradeImportScope) => TradeImportResult;
  renamePart: (partId: string, name: string, catalogId?: string) => void;
  removePart: (partId: string, catalogId?: string) => void;
  addConcept: (partId: string, concept: Omit<CatalogConcept, 'id'>, catalogId?: string) => string;
  updateConcept: (
    partId: string,
    conceptId: string,
    updates: Partial<Omit<CatalogConcept, 'id'>>,
    catalogId?: string,
  ) => void;
  removeConcept: (partId: string, conceptId: string, catalogId?: string) => void;
}
const queue = new WriteQueue<TariffCatalog>('catalog:', async (key, catalog) => {
  await updateTariffCatalogDoc(key.split('/')[0]!, catalog.id, catalog);
});
export function flushCatalogWrites() {
  return queue.flush();
}
export function setCatalogAuthGetter(_fn: () => string | null) {
  void _fn;
}
export function resetCatalogStore() {
  queue.clear();
  useCatalogStore.setState({ tariffs: [], catalogs: [], loaded: false, activeCatalogId: null });
}
export const useCatalogStore = create<CatalogState>((set, get) => {
  const editCatalog = (id: string, update: (catalog: TariffCatalog) => TariffCatalog) => {
    const uid = sessionUid();
    const current = get().catalogs.find((c) => c.id === id);
    if (!uid || !current) throw new Error('Espera a que se cargue el catálogo.');
    const next = { ...update(current), updatedAt: new Date().toISOString() };
    if (
      flattenCatalogParts(next.parts).some(
        (t) =>
          !Number.isFinite(t.basePrice) ||
          t.basePrice < 0 ||
          !Number.isFinite(t.cost) ||
          t.cost < 0,
      )
    )
      throw new Error('Revisa los precios del catálogo.');
    set((s) => ({
      catalogs: s.catalogs.map((c) => (c.id === id ? next : c)),
      ...(s.activeCatalogId === id ? { tariffs: flattenCatalogParts(next.parts) } : {}),
    }));
    queue.schedule(`${uid}/${id}`, next);
  };
  return {
    tariffs: [],
    catalogs: [],
    loaded: false,
    activeCatalogId: null,
    loadCatalogs: async (uid) => {
      if (get().loaded && sessionUid() === uid) return;
      const revision = sessionRevision();
      const [catalogs, selected] = await Promise.all([
        fetchTariffCatalogs(uid),
        fetchActiveTariffCatalogId(uid),
      ]);
      if (!isSessionCurrent(uid, revision)) return;
      const source =
        catalogs.find((c) => c.id === 'main-v1') ??
        catalogs.find((c) => c.id === selected) ??
        [...catalogs].sort((a, b) => a.id.localeCompare(b.id))[0];
      const legacy = await fetchLegacyTariffs(uid);
      if (!isSessionCurrent(uid, revision)) return;
      const now = new Date().toISOString();
      const base = BASE_CATALOGS.find((c) => c.id === 'reforma_general')!;
      const canonical = await ensureSingleCatalog(uid, {
        id: 'main-v1',
        name: 'Mi catálogo',
        parts: source
          ? catalogParts(source)
          : groupLegacyTariffs(
              legacy.length ? legacy : base.tariffs.map((t, i) => ({ ...t, id: `base-${i}` })),
            ),
        createdAt: source?.createdAt ?? now,
        updatedAt: now,
      });
      if (!isSessionCurrent(uid, revision)) return;
      for (const catalog of catalogs) {
        if (!isSessionCurrent(uid, revision)) return;
        if (catalog.id !== canonical.id) await deleteTariffCatalogDoc(uid, catalog.id);
      }
      if (!isSessionCurrent(uid, revision)) return;
      if (legacy.length) await deleteLegacyTariffs(uid);
      if (isSessionCurrent(uid, revision))
        set({
          catalogs: [canonical],
          activeCatalogId: canonical.id,
          tariffs: flattenCatalogParts(canonical.parts),
          loaded: true,
        });
    },
    addTariff: async (tariff, catalogId) => {
      const id = catalogId ?? get().activeCatalogId;
      if (id)
        editCatalog(id, (c) => {
          const name = tariff.category.trim() || 'Varios';
          const part = c.parts.find((item) => item.name === name);
          const concept = { ...tariff, id: generateId() };
          const value = { ...concept };
          Reflect.deleteProperty(value, 'category');
          Reflect.deleteProperty(value, 'partId');
          return {
            ...c,
            parts: part
              ? c.parts.map((item) =>
                  item.id === part.id ? { ...item, concepts: [...item.concepts, value] } : item,
                )
              : [...c.parts, { id: legacyPartId(name), name, concepts: [value] }],
          };
        });
    },
    updateTariff: async (id, updates, targetCatalogId) => {
      const catalogId = targetCatalogId ?? get().activeCatalogId;
      if (catalogId)
        editCatalog(catalogId, (c) => ({
          ...c,
          parts: c.parts.map((part) => ({
            ...part,
            concepts: part.concepts.map((concept) =>
              concept.id === id ? { ...concept, ...updates } : concept,
            ),
          })),
        }));
    },
    removeTariff: async (id, targetCatalogId) => {
      const catalogId = targetCatalogId ?? get().activeCatalogId;
      if (catalogId)
        editCatalog(catalogId, (c) => ({
          ...c,
          parts: c.parts.map((part) => ({
            ...part,
            concepts: part.concepts.filter((concept) => concept.id !== id),
          })),
        }));
    },
    addPart: (name, catalogId) => {
      const id = generateId();
      const targetId = catalogId ?? get().activeCatalogId;
      if (!targetId) throw new Error('Espera a que se cargue el catálogo.');
      editCatalog(targetId, (catalog) => ({
        ...catalog,
        parts: [...catalog.parts, { id, name: name.trim(), concepts: [] }],
      }));
      return id;
    },
    importTrade: (tradeId, catalogId, scope) => {
      const trade = TRADE_CATALOGS.find((item) => item.id === tradeId);
      if (!trade) throw new Error('No se encuentra el oficio que quieres importar.');
      const targetId = catalogId ?? get().activeCatalogId;
      const current = get().catalogs.find((item) => item.id === targetId);
      if (!targetId || !current) throw new Error('Espera a que se cargue el catálogo.');

      const result = mergeTradeIntoParts(current.parts, trade, undefined, scope);
      if (result.addedConcepts > 0)
        editCatalog(targetId, (catalog) => ({ ...catalog, parts: result.parts }));
      return result;
    },
    renamePart: (partId, name, catalogId) => {
      const targetId = catalogId ?? get().activeCatalogId;
      if (!targetId) return;
      editCatalog(targetId, (catalog) => ({
        ...catalog,
        parts: catalog.parts.map((part) =>
          part.id === partId ? { ...part, name: name.trim() } : part,
        ),
      }));
    },
    removePart: (partId, catalogId) => {
      const targetId = catalogId ?? get().activeCatalogId;
      if (!targetId) return;
      editCatalog(targetId, (catalog) => ({
        ...catalog,
        parts: catalog.parts.filter((part) => part.id !== partId),
      }));
    },
    addConcept: (partId, concept, catalogId) => {
      const targetId = catalogId ?? get().activeCatalogId;
      if (!targetId) throw new Error('Espera a que se cargue el catálogo.');
      const id = generateId();
      editCatalog(targetId, (catalog) => ({
        ...catalog,
        parts: catalog.parts.map((part) =>
          part.id === partId ? { ...part, concepts: [...part.concepts, { ...concept, id }] } : part,
        ),
      }));
      return id;
    },
    updateConcept: (partId, conceptId, updates, catalogId) => {
      const targetId = catalogId ?? get().activeCatalogId;
      if (!targetId) return;
      editCatalog(targetId, (catalog) => ({
        ...catalog,
        parts: catalog.parts.map((part) =>
          part.id === partId
            ? {
                ...part,
                concepts: part.concepts.map((concept) =>
                  concept.id === conceptId ? { ...concept, ...updates } : concept,
                ),
              }
            : part,
        ),
      }));
    },
    removeConcept: (partId, conceptId, catalogId) => {
      const targetId = catalogId ?? get().activeCatalogId;
      if (!targetId) return;
      editCatalog(targetId, (catalog) => ({
        ...catalog,
        parts: catalog.parts.map((part) =>
          part.id === partId
            ? { ...part, concepts: part.concepts.filter((concept) => concept.id !== conceptId) }
            : part,
        ),
      }));
    },
  };
});

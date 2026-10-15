import { create } from 'zustand';
import type { Tariff, TariffCatalog } from '@/shared/types';
import { generateId } from '@/shared/lib';
import { WriteQueue } from '@/shared/lib/writeQueue';
import { isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import { BASE_CATALOGS } from './baseCatalogs';
import {
  deleteLegacyTariffs,
  deleteTariffCatalogDoc,
  fetchActiveTariffCatalogId,
  fetchLegacyTariffs,
  fetchTariffCatalogs,
  saveActiveTariffCatalogId,
  saveTariffCatalog,
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
  createCatalogFromBase: (baseId: string) => Promise<string | null>;
  selectCatalog: (id: string) => Promise<void>;
  renameCatalog: (id: string, name: string) => Promise<void>;
  deleteCatalog: (id: string) => Promise<void>;
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
    if (!uid || !current) throw new Error('Selecciona un catálogo para continuar.');
    const next = { ...update(current), updatedAt: new Date().toISOString() };
    if (
      next.tariffs.some(
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
      ...(s.activeCatalogId === id ? { tariffs: next.tariffs } : {}),
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
      let [catalogs, selected] = await Promise.all([
        fetchTariffCatalogs(uid),
        fetchActiveTariffCatalogId(uid),
      ]);
      if (!isSessionCurrent(uid, revision)) return;
      if (!catalogs.length) {
        const legacy = await fetchLegacyTariffs(uid);
        if (!isSessionCurrent(uid, revision)) return;
        if (legacy.length) {
          const now = new Date().toISOString();
          const migrated = {
            id: 'legacy-v1',
            name: 'Mi catálogo',
            tariffs: legacy,
            createdAt: now,
            updatedAt: now,
          };
          await saveTariffCatalog(uid, migrated);
          if (!isSessionCurrent(uid, revision)) return;
          await saveActiveTariffCatalogId(uid, migrated.id);
          await deleteLegacyTariffs(uid);
          catalogs = [migrated];
          selected = migrated.id;
        }
      }
      const active = catalogs.find((c) => c.id === selected) ?? catalogs[0];
      if (active && active.id !== selected) await saveActiveTariffCatalogId(uid, active.id);
      if (isSessionCurrent(uid, revision))
        set({
          catalogs,
          activeCatalogId: active?.id ?? null,
          tariffs: active?.tariffs ?? [],
          loaded: true,
        });
    },
    addTariff: async (tariff, catalogId) => {
      const id = catalogId ?? get().activeCatalogId;
      if (id)
        editCatalog(id, (c) => ({
          ...c,
          tariffs: [...c.tariffs, { ...tariff, id: generateId() }],
        }));
    },
    updateTariff: async (id, updates, targetCatalogId) => {
      const catalogId = targetCatalogId ?? get().activeCatalogId;
      if (catalogId)
        editCatalog(catalogId, (c) => ({
          ...c,
          tariffs: c.tariffs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
    },
    removeTariff: async (id, targetCatalogId) => {
      const catalogId = targetCatalogId ?? get().activeCatalogId;
      if (catalogId)
        editCatalog(catalogId, (c) => ({ ...c, tariffs: c.tariffs.filter((t) => t.id !== id) }));
    },
    createCatalogFromBase: async (baseId) => {
      const uid = sessionUid();
      const revision = sessionRevision();
      const base = BASE_CATALOGS.find((c) => c.id === baseId);
      if (!uid || !base) return null;
      const names = new Set(get().catalogs.map((c) => c.name));
      let name = base.name;
      let suffix = 2;
      while (names.has(name)) name = `${base.name} ${suffix++}`;
      const now = new Date().toISOString();
      const catalog: TariffCatalog = {
        id: generateId(),
        name,
        baseCatalogId: baseId,
        tariffs: base.tariffs.map((t) => ({ ...t, id: generateId() })),
        createdAt: now,
        updatedAt: now,
      };
      await saveTariffCatalog(uid, catalog);
      await saveActiveTariffCatalogId(uid, catalog.id);
      if (isSessionCurrent(uid, revision)) {
        set((s) => ({
          catalogs: [...s.catalogs, catalog],
          activeCatalogId: catalog.id,
          tariffs: catalog.tariffs,
        }));
        return catalog.id;
      }
      return null;
    },
    selectCatalog: async (id) => {
      const uid = sessionUid();
      const revision = sessionRevision();
      if (!uid || !get().catalogs.some((c) => c.id === id)) return;
      await saveActiveTariffCatalogId(uid, id);
      if (isSessionCurrent(uid, revision))
        set({
          activeCatalogId: id,
          tariffs: get().catalogs.find((c) => c.id === id)?.tariffs ?? [],
        });
    },
    renameCatalog: async (id, name) => {
      if (name.trim()) editCatalog(id, (c) => ({ ...c, name: name.trim() }));
    },
    deleteCatalog: async (id) => {
      const uid = sessionUid();
      const revision = sessionRevision();
      if (!uid) return;
      await queue.cancel(`${uid}/${id}`);
      await deleteTariffCatalogDoc(uid, id);
      const catalogs = get().catalogs.filter((c) => c.id !== id);
      const next = catalogs.find((c) => c.id === get().activeCatalogId) ?? catalogs[0];
      await saveActiveTariffCatalogId(uid, next?.id ?? null);
      if (isSessionCurrent(uid, revision))
        set({ catalogs, activeCatalogId: next?.id ?? null, tariffs: next?.tariffs ?? [] });
    },
  };
});

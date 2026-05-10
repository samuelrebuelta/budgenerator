import { create } from 'zustand';
import type { Tariff, TariffCatalog } from '@/shared/types';
import { generateId } from '@/shared/lib';
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
} from '@/entities/catalog/api/firestore';

let _getUid: (() => string | null) | null = null;

export function setCatalogAuthGetter(fn: () => string | null) {
  _getUid = fn;
}

function getUid(): string | null {
  return _getUid?.() ?? null;
}

interface CatalogState {
  tariffs: Tariff[];
  catalogs: TariffCatalog[];
  loaded: boolean;
  activeCatalogId: string | null;
  loadCatalogs: (uid: string) => Promise<void>;
  addTariff: (tariff: Omit<Tariff, 'id'>) => Promise<void>;
  updateTariff: (id: string, updates: Partial<Omit<Tariff, 'id'>>) => Promise<void>;
  removeTariff: (id: string) => Promise<void>;
  createCatalogFromBase: (baseCatalogId: string) => Promise<void>;
  selectCatalog: (catalogId: string) => Promise<void>;
  renameCatalog: (catalogId: string, name: string) => Promise<void>;
  deleteCatalog: (catalogId: string) => Promise<void>;
}

function cloneBaseCatalogTariffs(baseCatalogId: string): Tariff[] {
  const baseCatalog = BASE_CATALOGS.find((catalog) => catalog.id === baseCatalogId);
  if (!baseCatalog) return [];

  return baseCatalog.tariffs.map((tariff) => ({
    ...tariff,
    id: generateId(),
  }));
}

function buildUniqueCatalogName(baseName: string, catalogs: TariffCatalog[]): string {
  const existingNames = new Set(catalogs.map((catalog) => catalog.name));
  if (!existingNames.has(baseName)) return baseName;

  let suffix = 2;
  while (existingNames.has(`${baseName} ${suffix}`)) {
    suffix += 1;
  }

  return `${baseName} ${suffix}`;
}

function getActiveCatalog(catalogs: TariffCatalog[], activeCatalogId: string | null) {
  return catalogs.find((catalog) => catalog.id === activeCatalogId) ?? null;
}

function withUpdatedCatalog(
  catalogs: TariffCatalog[],
  catalogId: string,
  updater: (catalog: TariffCatalog) => TariffCatalog,
) {
  return catalogs.map((catalog) => (catalog.id === catalogId ? updater(catalog) : catalog));
}

export const useCatalogStore = create<CatalogState>()(
  (set, get) => ({
    tariffs: [],
    catalogs: [],
    loaded: false,
    activeCatalogId: null,

    loadCatalogs: async (uid) => {
      if (get().loaded) return;
      let catalogs = await fetchTariffCatalogs(uid);
      let activeCatalogId = await fetchActiveTariffCatalogId(uid);

      if (catalogs.length === 0) {
        const legacyTariffs = await fetchLegacyTariffs(uid);
        if (legacyTariffs.length > 0) {
          const now = new Date().toISOString();
          const migratedCatalog: TariffCatalog = {
            id: generateId(),
            name: 'Mi catálogo',
            tariffs: legacyTariffs,
            createdAt: now,
            updatedAt: now,
          };
          await saveTariffCatalog(uid, migratedCatalog);
          await saveActiveTariffCatalogId(uid, migratedCatalog.id);
          await deleteLegacyTariffs(uid);
          catalogs = [migratedCatalog];
          activeCatalogId = migratedCatalog.id;
        }
      }

      const firstCatalog = catalogs[0];
      if (!activeCatalogId && firstCatalog) {
        activeCatalogId = firstCatalog.id;
        await saveActiveTariffCatalogId(uid, activeCatalogId);
      }

      const activeCatalog = getActiveCatalog(catalogs, activeCatalogId);
      set({
        catalogs,
        activeCatalogId,
        tariffs: activeCatalog?.tariffs ?? [],
        loaded: true,
      });
    },

    addTariff: async (tariff) => {
      const uid = getUid();
      const activeCatalogId = get().activeCatalogId;
      if (!uid || !activeCatalogId) return;

      const newTariff = { ...tariff, id: generateId() };
      const now = new Date().toISOString();
      const catalogs = withUpdatedCatalog(get().catalogs, activeCatalogId, (catalog) => ({
        ...catalog,
        tariffs: [...catalog.tariffs, newTariff],
        updatedAt: now,
      }));
      const activeCatalog = getActiveCatalog(catalogs, activeCatalogId);

      await updateTariffCatalogDoc(uid, activeCatalogId, {
        tariffs: activeCatalog?.tariffs ?? [],
        updatedAt: now,
      });

      set({
        catalogs,
        tariffs: activeCatalog?.tariffs ?? [],
      });
    },

    updateTariff: async (id, updates) => {
      const uid = getUid();
      const activeCatalogId = get().activeCatalogId;
      if (!uid || !activeCatalogId) return;

      const now = new Date().toISOString();
      const catalogs = withUpdatedCatalog(get().catalogs, activeCatalogId, (catalog) => ({
        ...catalog,
        tariffs: catalog.tariffs.map((tariff) =>
          tariff.id === id ? { ...tariff, ...updates } : tariff,
        ),
        updatedAt: now,
      }));
      const activeCatalog = getActiveCatalog(catalogs, activeCatalogId);

      await updateTariffCatalogDoc(uid, activeCatalogId, {
        tariffs: activeCatalog?.tariffs ?? [],
        updatedAt: now,
      });

      set({
        catalogs,
        tariffs: activeCatalog?.tariffs ?? [],
      });
    },

    removeTariff: async (id) => {
      const uid = getUid();
      const activeCatalogId = get().activeCatalogId;
      if (!uid || !activeCatalogId) return;

      const now = new Date().toISOString();
      const catalogs = withUpdatedCatalog(get().catalogs, activeCatalogId, (catalog) => ({
        ...catalog,
        tariffs: catalog.tariffs.filter((tariff) => tariff.id !== id),
        updatedAt: now,
      }));
      const activeCatalog = getActiveCatalog(catalogs, activeCatalogId);

      await updateTariffCatalogDoc(uid, activeCatalogId, {
        tariffs: activeCatalog?.tariffs ?? [],
        updatedAt: now,
      });

      set({
        catalogs,
        tariffs: activeCatalog?.tariffs ?? [],
      });
    },

    createCatalogFromBase: async (baseCatalogId) => {
      const uid = getUid();
      if (!uid) return;

      const baseCatalog = BASE_CATALOGS.find((catalog) => catalog.id === baseCatalogId);
      if (!baseCatalog) return;

      const now = new Date().toISOString();
      const catalog: TariffCatalog = {
        id: generateId(),
        name: buildUniqueCatalogName(baseCatalog.name, get().catalogs),
        baseCatalogId,
        tariffs: cloneBaseCatalogTariffs(baseCatalogId),
        createdAt: now,
        updatedAt: now,
      };

      await saveTariffCatalog(uid, catalog);
      await saveActiveTariffCatalogId(uid, catalog.id);

      set((state) => ({
        catalogs: [...state.catalogs, catalog],
        activeCatalogId: catalog.id,
        tariffs: catalog.tariffs,
      }));
    },

    selectCatalog: async (catalogId) => {
      const uid = getUid();
      if (!uid) return;

      const activeCatalog = getActiveCatalog(get().catalogs, catalogId);
      if (!activeCatalog) return;

      await saveActiveTariffCatalogId(uid, catalogId);
      set({
        activeCatalogId: catalogId,
        tariffs: activeCatalog.tariffs,
      });
    },

    renameCatalog: async (catalogId, name) => {
      const uid = getUid();
      if (!uid) return;

      const trimmedName = name.trim();
      if (!trimmedName) return;

      const now = new Date().toISOString();
      const catalogs = withUpdatedCatalog(get().catalogs, catalogId, (catalog) => ({
        ...catalog,
        name: trimmedName,
        updatedAt: now,
      }));

      await updateTariffCatalogDoc(uid, catalogId, {
        name: trimmedName,
        updatedAt: now,
      });

      set({ catalogs });
    },

    deleteCatalog: async (catalogId) => {
      const uid = getUid();
      if (!uid) return;

      const remainingCatalogs = get().catalogs.filter((catalog) => catalog.id !== catalogId);
      const nextActiveCatalogId = get().activeCatalogId === catalogId
        ? (remainingCatalogs[0]?.id ?? null)
        : get().activeCatalogId;
      const nextActiveCatalog = getActiveCatalog(remainingCatalogs, nextActiveCatalogId);

      await deleteTariffCatalogDoc(uid, catalogId);
      await saveActiveTariffCatalogId(uid, nextActiveCatalogId);

      set({
        catalogs: remainingCatalogs,
        activeCatalogId: nextActiveCatalogId,
        tariffs: nextActiveCatalog?.tariffs ?? [],
      });
    },
  }),
);

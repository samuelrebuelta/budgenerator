import { create } from 'zustand';
import type { Tariff } from '@/shared/types';
import { generateId } from '@/shared/lib';
import { DEFAULT_TARIFFS } from './catalog';
import {
  fetchTariffs,
  saveTariff,
  updateTariffDoc,
  deleteTariffDoc,
  seedTariffs,
  deleteAllTariffs,
} from '@/shared/firebase';

let _getUid: (() => string | null) | null = null;

export function setTariffAuthGetter(fn: () => string | null) {
  _getUid = fn;
}

function getUid(): string | null {
  return _getUid?.() ?? null;
}

interface TariffState {
  tariffs: Tariff[];
  loaded: boolean;
  loadTariffs: (uid: string) => Promise<void>;
  addTariff: (tariff: Omit<Tariff, 'id'>) => Promise<void>;
  updateTariff: (id: string, updates: Partial<Omit<Tariff, 'id'>>) => Promise<void>;
  removeTariff: (id: string) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useTariffStore = create<TariffState>()(
  (set, get) => ({
    tariffs: [],
    loaded: false,

    loadTariffs: async (uid) => {
      if (get().loaded) return;
      const tariffs = await fetchTariffs(uid);
      if (tariffs.length === 0) {
        await seedTariffs(uid, DEFAULT_TARIFFS);
        set({ tariffs: DEFAULT_TARIFFS, loaded: true });
      } else {
        set({ tariffs, loaded: true });
      }
    },

    addTariff: async (tariff) => {
      const uid = getUid();
      const newTariff = { ...tariff, id: generateId() };
      if (uid) await saveTariff(uid, newTariff);
      set((state) => ({
        tariffs: [...state.tariffs, newTariff],
      }));
    },

    updateTariff: async (id, updates) => {
      const uid = getUid();
      if (uid) await updateTariffDoc(uid, id, updates);
      set((state) => ({
        tariffs: state.tariffs.map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        ),
      }));
    },

    removeTariff: async (id) => {
      const uid = getUid();
      if (uid) await deleteTariffDoc(uid, id);
      set((state) => ({
        tariffs: state.tariffs.filter((t) => t.id !== id),
      }));
    },

    resetToDefaults: async () => {
      const uid = getUid();
      if (uid) {
        await deleteAllTariffs(uid);
        await seedTariffs(uid, DEFAULT_TARIFFS);
      }
      set({ tariffs: DEFAULT_TARIFFS });
    },
  }),
);

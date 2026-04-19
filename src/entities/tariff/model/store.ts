import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tariff } from '@/shared/types';
import { generateId } from '@/shared/lib';
import { DEFAULT_TARIFFS } from './catalog';

interface TariffState {
  tariffs: Tariff[];
  addTariff: (tariff: Omit<Tariff, 'id'>) => void;
  updateTariff: (id: string, updates: Partial<Omit<Tariff, 'id'>>) => void;
  removeTariff: (id: string) => void;
  resetToDefaults: () => void;
}

export const useTariffStore = create<TariffState>()(
  persist(
    (set) => ({
      tariffs: DEFAULT_TARIFFS,

      addTariff: (tariff) =>
        set((state) => ({
          tariffs: [...state.tariffs, { ...tariff, id: generateId() }],
        })),

      updateTariff: (id, updates) =>
        set((state) => ({
          tariffs: state.tariffs.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
        })),

      removeTariff: (id) =>
        set((state) => ({
          tariffs: state.tariffs.filter((t) => t.id !== id),
        })),

      resetToDefaults: () => set({ tariffs: DEFAULT_TARIFFS }),
    }),
    {
      name: 'renovation-tariff-catalog',
      version: 2,
      migrate: () => ({ tariffs: DEFAULT_TARIFFS }),
    },
  ),
);

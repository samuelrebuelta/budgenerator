import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({
  fetchTariffCatalogs: vi.fn(),
  fetchActiveTariffCatalogId: vi.fn(),
  updateTariffCatalogDoc: vi.fn(),
  fetchLegacyTariffs: vi.fn(),
}));
vi.mock('../src/entities/catalog/api/firestore', () => api);
import {
  useCatalogStore as store,
  resetCatalogStore,
  flushCatalogWrites,
} from '../src/entities/catalog/model/store';
import { setSessionUid } from '../src/shared/model/session';
import { catalog } from './fixtures';
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  setSessionUid('alice');
  resetCatalogStore();
  api.fetchTariffCatalogs.mockResolvedValue([catalog()]);
  api.fetchActiveTariffCatalogId.mockResolvedValue('catalog-a');
  api.updateTariffCatalogDoc.mockResolvedValue(undefined);
});
afterEach(() => {
  resetCatalogStore();
  vi.useRealTimers();
});
it('coalesces edits from the latest state instead of overwriting another field', async () => {
  await store.getState().loadCatalogs('alice');
  await store.getState().updateTariff('tariff-a', { description: 'Updated' });
  await store.getState().updateTariff('tariff-a', { cost: 5.25 });
  await flushCatalogWrites();
  expect(api.updateTariffCatalogDoc).toHaveBeenCalledTimes(1);
  expect(api.updateTariffCatalogDoc.mock.calls[0]![2].tariffs[0]).toMatchObject({
    description: 'Updated',
    cost: 5.25,
  });
});
it('loads a new account instead of reusing a previous loaded flag', async () => {
  await store.getState().loadCatalogs('alice');
  setSessionUid('bob');
  resetCatalogStore();
  await store.getState().loadCatalogs('bob');
  expect(api.fetchTariffCatalogs.mock.calls.map((c) => c[0])).toEqual(['alice', 'bob']);
});
it('edits a catalog opened by URL without changing the default or another catalog with the same tariff ID', async () => {
  api.fetchTariffCatalogs.mockResolvedValue([
    catalog(),
    { ...catalog(), id: 'catalog-b', name: 'Segundo' },
  ]);
  await store.getState().loadCatalogs('alice');
  await store.getState().updateTariff('tariff-a', { cost: 7.5 }, 'catalog-b');
  await store
    .getState()
    .addTariff(
      { description: 'Nueva tarifa', unit: 'unit', cost: 5, basePrice: 10, category: 'Varios' },
      'catalog-b',
    );
  await flushCatalogWrites();
  expect(store.getState().activeCatalogId).toBe('catalog-a');
  expect(store.getState().tariffs).toHaveLength(1);
  expect(store.getState().tariffs[0]?.cost).toBe(4.5);
  expect(store.getState().catalogs.find((item) => item.id === 'catalog-b')?.tariffs).toHaveLength(
    2,
  );
  expect(api.updateTariffCatalogDoc.mock.calls[0]?.[1]).toBe('catalog-b');
  await store.getState().removeTariff('tariff-a', 'catalog-b');
  await flushCatalogWrites();
  expect(store.getState().tariffs[0]?.id).toBe('tariff-a');
  expect(
    store
      .getState()
      .catalogs.find((item) => item.id === 'catalog-b')
      ?.tariffs.map((item) => item.description),
  ).toEqual(['Nueva tarifa']);
});

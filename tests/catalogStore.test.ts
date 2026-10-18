import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  fetchTariffCatalogs: vi.fn(),
  fetchActiveTariffCatalogId: vi.fn(),
  fetchLegacyTariffs: vi.fn(),
  ensureSingleCatalog: vi.fn(),
  deleteTariffCatalogDoc: vi.fn(),
  deleteLegacyTariffs: vi.fn(),
  updateTariffCatalogDoc: vi.fn(),
}));
vi.mock('../src/entities/catalog/api/firestore', () => api);
import {
  useCatalogStore as store,
  resetCatalogStore,
  flushCatalogWrites,
} from '../src/entities/catalog/model/store';
import { catalog as fixtureCatalog } from './fixtures';
import { setSessionUid } from '../src/shared/model/session';
const catalog = (id: string) => ({ id, name: id, parts: [], createdAt: '', updatedAt: '' });
beforeEach(() => {
  vi.clearAllMocks();
  setSessionUid('alice');
  resetCatalogStore();
  api.fetchTariffCatalogs.mockResolvedValue([]);
  api.fetchActiveTariffCatalogId.mockResolvedValue(null);
  api.fetchLegacyTariffs.mockResolvedValue([]);
  api.ensureSingleCatalog.mockImplementation(async (_uid, value) => value);
  api.deleteTariffCatalogDoc.mockResolvedValue(undefined);
});
afterEach(resetCatalogStore);
it('initializes one deterministic catalog with the general renovation base', async () => {
  await store.getState().loadCatalogs('alice');
  expect(store.getState().catalogs).toHaveLength(1);
  expect(store.getState().activeCatalogId).toBe('main-v1');
  expect(new Set(store.getState().tariffs.map((tariff) => tariff.category))).toEqual(
    new Set([
      'Demolición y residuos',
      'Albañilería y tabiquería',
      'Suelos y revestimientos',
      'Pintura',
      'Electricidad',
      'Fontanería y sanitarios',
      'Carpintería',
      'Servicios auxiliares',
    ]),
  );
  await store.getState().loadCatalogs('alice');
  expect(api.ensureSingleCatalog).toHaveBeenCalledTimes(1);
});
it('saves a canonical copy of the selected catalog before removing test catalogs', async () => {
  api.fetchTariffCatalogs.mockResolvedValue([catalog('a'), catalog('b')]);
  api.fetchActiveTariffCatalogId.mockResolvedValue('b');
  await store.getState().loadCatalogs('alice');
  expect(api.ensureSingleCatalog.mock.calls[0]?.[1]).toMatchObject({
    id: 'main-v1',
    name: 'Mi catálogo',
  });
  expect(api.ensureSingleCatalog.mock.invocationCallOrder[0]).toBeLessThan(
    api.deleteTariffCatalogDoc.mock.invocationCallOrder[0]!,
  );
  expect(api.deleteTariffCatalogDoc).toHaveBeenCalledTimes(2);
  expect(store.getState().catalogs).toHaveLength(1);
});
it('does not delete sources if creating the destination fails and can retry', async () => {
  api.fetchTariffCatalogs.mockResolvedValue([catalog('a')]);
  api.ensureSingleCatalog.mockRejectedValueOnce(Error('offline'));
  await expect(store.getState().loadCatalogs('alice')).rejects.toThrow('offline');
  expect(api.deleteTariffCatalogDoc).not.toHaveBeenCalled();
  expect(store.getState().loaded).toBe(false);
  await store.getState().loadCatalogs('alice');
  expect(store.getState().loaded).toBe(true);
});
it('ignores stale sessions before deleting catalogs or populating state', async () => {
  api.ensureSingleCatalog.mockImplementation(async (_uid, value) => {
    setSessionUid('bob');
    return value;
  });
  api.fetchTariffCatalogs.mockResolvedValue([catalog('a')]);
  await store.getState().loadCatalogs('alice');
  expect(api.deleteTariffCatalogDoc).not.toHaveBeenCalled();
  expect(store.getState().loaded).toBe(false);
});

it('coalesces edits from the latest state instead of overwriting another field', async () => {
  api.fetchTariffCatalogs.mockResolvedValue([fixtureCatalog()]);
  await store.getState().loadCatalogs('alice');
  await store.getState().updateTariff('tariff-a', { description: 'Updated' });
  await store.getState().updateTariff('tariff-a', { cost: 5.25 });
  await flushCatalogWrites();
  expect(api.updateTariffCatalogDoc).toHaveBeenCalledTimes(1);
  expect(api.updateTariffCatalogDoc.mock.calls[0]![2].parts[0].concepts[0]).toMatchObject({
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
it('retries cleanup without replacing the canonical destination', async () => {
  const saved = { ...fixtureCatalog(), id: 'main-v1', name: 'Mi catálogo' };
  api.fetchTariffCatalogs.mockResolvedValue([fixtureCatalog()]);
  api.ensureSingleCatalog.mockResolvedValue(saved);
  api.deleteTariffCatalogDoc.mockRejectedValueOnce(Error('cleanup failed'));
  await expect(store.getState().loadCatalogs('alice')).rejects.toThrow('cleanup failed');
  api.fetchTariffCatalogs.mockResolvedValue([saved, fixtureCatalog()]);
  await store.getState().loadCatalogs('alice');
  expect(store.getState().tariffs).toMatchObject([
    { id: 'tariff-a', description: 'Original', category: 'Pintura', partId: 'part-pintura' },
  ]);
  expect(store.getState().catalogs).toEqual([saved]);
});
it('retries interrupted legacy cleanup after the canonical destination already exists', async () => {
  api.fetchLegacyTariffs.mockResolvedValue([
    {
      id: 'tariff-a',
      description: 'Original',
      unit: 'm2',
      basePrice: 10.75,
      cost: 4.5,
      category: 'Pintura',
    },
  ]);
  api.deleteLegacyTariffs
    .mockRejectedValueOnce(Error('cleanup failed'))
    .mockResolvedValue(undefined);
  await expect(store.getState().loadCatalogs('alice')).rejects.toThrow('cleanup failed');
  const saved = { ...fixtureCatalog(), id: 'main-v1', name: 'Mi catálogo' };
  api.fetchTariffCatalogs.mockResolvedValue([saved]);
  await store.getState().loadCatalogs('alice');
  expect(api.deleteLegacyTariffs).toHaveBeenCalledTimes(2);
  expect(store.getState().loaded).toBe(true);
});

it('keeps concept membership when renaming a partida', async () => {
  api.fetchTariffCatalogs.mockResolvedValue([fixtureCatalog()]);
  await store.getState().loadCatalogs('alice');
  store.getState().renamePart('part-pintura', 'Acabados');

  expect(store.getState().catalogs[0]?.parts[0]).toMatchObject({
    id: 'part-pintura',
    name: 'Acabados',
    concepts: [{ id: 'tariff-a', description: 'Original' }],
  });
  await flushCatalogWrites();
});

it('adds and removes a concept under its partida without changing other partidas', async () => {
  api.fetchTariffCatalogs.mockResolvedValue([fixtureCatalog()]);
  await store.getState().loadCatalogs('alice');
  store.getState().addConcept('part-pintura', {
    description: 'Nueva pintura',
    unit: 'm2',
    basePrice: 18,
    cost: 8,
  });
  const added = store.getState().catalogs[0]?.parts[0]?.concepts[1];
  expect(added).toMatchObject({ description: 'Nueva pintura', basePrice: 18 });
  if (added) store.getState().removeConcept('part-pintura', added.id);
  expect(store.getState().catalogs[0]?.parts[0]?.concepts).toHaveLength(1);
  await flushCatalogWrites();
});

it('imports a trade once and keeps concepts already customized in the catalog', async () => {
  api.fetchTariffCatalogs.mockResolvedValue([fixtureCatalog()]);
  await store.getState().loadCatalogs('alice');

  const firstImport = store.getState().importTrade('pintura');
  const secondImport = store.getState().importTrade('pintura');
  const paintPart = store.getState().catalogs[0]?.parts.find((part) => part.id === 'part-pintura');

  expect(firstImport.addedConcepts).toBeGreaterThan(0);
  expect(secondImport).toMatchObject({ addedParts: 0, addedConcepts: 0 });
  expect(paintPart?.concepts).toContainEqual({
    id: 'tariff-a',
    description: 'Original',
    unit: 'm2',
    basePrice: 10.75,
    cost: 4.5,
  });
  await flushCatalogWrites();
  expect(api.updateTariffCatalogDoc).toHaveBeenCalledTimes(1);
});

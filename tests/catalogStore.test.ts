import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  ensureCatalog: vi.fn(),
  fetchCatalog: vi.fn(),
  saveCatalog: vi.fn(),
}));
vi.mock('../src/entities/catalog/api/firestore', () => api);
import {
  useCatalogStore as store,
  resetCatalogStore,
  flushCatalogWrites,
} from '../src/entities/catalog/model/store';
import { catalogView, type CatalogRecord } from '../src/entities/catalog/model/record';
import { parseBc3 } from '../src/entities/construction-document/bc3';
import { RevisionConflictError } from '../src/entities/construction-document/api/storage';
import { setSessionUid } from '../src/shared/model/session';
import { sampleDocument } from './fixtures';

const record = (document = sampleDocument('catalog'), revision = 1): CatalogRecord => ({
  id: 'main',
  revision,
  createdAt: '',
  updatedAt: '',
  document,
});
const view = () => catalogView(store.getState().record!);

beforeEach(() => {
  vi.clearAllMocks();
  setSessionUid('alice');
  resetCatalogStore();
  api.ensureCatalog.mockImplementation(async (_uid, seed) => record(seed));
  api.saveCatalog.mockImplementation(async (_uid, _record, expected: number) => expected + 1);
});
afterEach(resetCatalogStore);

it('seeds the canonical catalog with the complete renovation base', async () => {
  await store.getState().loadCatalogs('alice');
  expect(api.ensureCatalog).toHaveBeenCalledTimes(1);
  const seed = api.ensureCatalog.mock.calls[0]![1];
  expect(seed.kind).toBe('catalog');
  expect(view().parts.map((part) => part.name)).toEqual(
    expect.arrayContaining(['Accesibilidad', 'Electricidad', 'Pintura', 'Vidrio']),
  );
  expect(
    view().tariffs.every((tariff) => ['m2', 'm3', 'ml', 'ud', 'h'].includes(tariff.unit)),
  ).toBe(true);
  await store.getState().loadCatalogs('alice');
  expect(api.ensureCatalog).toHaveBeenCalledTimes(1);
});

it('ignores stale sessions before populating state', async () => {
  let resolve!: (value: CatalogRecord) => void;
  api.ensureCatalog.mockImplementation(() => new Promise((r) => (resolve = r)));
  const loading = store.getState().loadCatalogs('alice');
  setSessionUid('bob');
  resetCatalogStore();
  resolve(record());
  await loading;
  expect(store.getState().record).toBeNull();
});

it('coalesces edits from the latest state and saves with the tracked revision', async () => {
  api.ensureCatalog.mockResolvedValue(record(sampleDocument('catalog'), 3));
  await store.getState().loadCatalogs('alice');
  const part = view().parts[0]!;
  const concept = part.concepts[0]!;
  store.getState().updateConcept(part.id, concept.id, { basePrice: 12 });
  store.getState().updateConcept(part.id, concept.id, { description: 'Pintura lisa' });
  await flushCatalogWrites();
  expect(api.saveCatalog).toHaveBeenCalledTimes(1);
  expect(api.saveCatalog.mock.calls[0]![2]).toBe(3);
  expect(catalogView(api.saveCatalog.mock.calls[0]![1]).parts[0]!.concepts[0]).toMatchObject({
    description: 'Pintura lisa',
    basePrice: 12,
    cost: 4.5,
  });
  expect(store.getState().record!.revision).toBe(4);
});

it('keeps partida membership when renaming a chapter and removes partidas only from it', async () => {
  await store.getState().loadCatalogs('alice');
  api.ensureCatalog.mockClear();
  store.setState({ record: record() });
  const part = view().parts[0]!;
  store.getState().renamePart(part.id, 'Acabados');
  expect(view().parts[0]).toMatchObject({
    id: part.id,
    name: 'Acabados',
    concepts: [{ description: 'Original' }],
  });
  const added = store.getState().addConcept(part.id, {
    description: 'Nueva pintura',
    unit: 'kg',
    basePrice: 18,
    cost: 8,
  });
  expect(view().parts[0]!.concepts[1]).toMatchObject({ description: 'Nueva pintura', unit: 'kg' });
  store.getState().removeConcept(part.id, added);
  expect(view().parts[0]!.concepts).toHaveLength(1);
  await flushCatalogWrites();
});

it('imports a trade once and keeps concepts already customized in the catalog', async () => {
  await store.getState().loadCatalogs('alice');
  store.setState({ record: record() });
  const firstImport = store.getState().importTrade('reforma_integral');
  const secondImport = store.getState().importTrade('reforma_integral');
  const paintPart = view().parts.find((part) => part.name === 'Pintura');
  expect(firstImport.addedConcepts).toBeGreaterThan(0);
  expect(secondImport).toMatchObject({ addedParts: 0, addedConcepts: 0 });
  expect(paintPart?.concepts).toContainEqual(
    expect.objectContaining({ description: 'Original', unit: 'm2', basePrice: 10.75, cost: 4.5 }),
  );
  await flushCatalogWrites();
  expect(api.saveCatalog).toHaveBeenCalledTimes(1);
});

it('merges a BC3 price base once, keeping codes and decompositions', async () => {
  await store.getState().loadCatalogs('alice');
  store.setState({ record: record() });
  const parsed = parseBc3(
    new Uint8Array(readFileSync('tests/fixtures/bc3/base-precios-ansi.bc3')),
    {
      target: 'catalog',
    },
  );
  const first = await store.getState().importDocument(parsed.document!);
  expect(first).toEqual({ addedParts: 3, addedConcepts: 5 });
  expect(api.saveCatalog).toHaveBeenCalledTimes(1);
  const wall = view().tariffs.find((tariff) => tariff.code === 'E02ALI');
  expect(wall).toMatchObject({
    basePrice: 39.07,
    composed: true,
    category: 'Revestimientos y acabados',
  });
  const second = await store.getState().importDocument(parsed.document!);
  expect(second).toEqual({ addedParts: 0, addedConcepts: 0 });
});

it('rolls back a failed BC3 import and reports conflicts', async () => {
  await store.getState().loadCatalogs('alice');
  const before = record();
  store.setState({ record: before });
  api.saveCatalog.mockRejectedValueOnce(new Error('offline'));
  const parsed = parseBc3(
    new Uint8Array(readFileSync('tests/fixtures/bc3/base-precios-ansi.bc3')),
    {
      target: 'catalog',
    },
  );
  await expect(store.getState().importDocument(parsed.document!)).rejects.toThrow('offline');
  expect(store.getState().record).toBe(before);

  api.saveCatalog.mockRejectedValueOnce(new RevisionConflictError());
  store.getState().addPart('Nuevo');
  await expect(flushCatalogWrites()).rejects.toBeInstanceOf(RevisionConflictError);
  expect(store.getState().conflict).toBe(true);
  api.fetchCatalog.mockResolvedValue(record(sampleDocument('catalog'), 9));
  await store.getState().reloadCatalog();
  expect(store.getState().conflict).toBe(false);
  expect(store.getState().record!.revision).toBe(9);
});

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import type { TariffCatalog } from '../src/shared/types';
let env: RulesTestEnvironment;
let adapter: typeof import('../src/entities/catalog/api/firestore');
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Only emulators allowed');
  env = await initializeTestEnvironment({
    projectId: 'demo-bg008-catalog',
    firestore: { host: '127.0.0.1', port: 8180, rules: readFileSync('firestore.rules', 'utf8') },
  });
  const db = env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  vi.doMock('../src/shared/firebase/config', () => ({ db }));
  adapter = await import('../src/entities/catalog/api/firestore');
});
afterAll(async () => {
  await env.cleanup();
  vi.doUnmock('../src/shared/firebase/config');
});
beforeEach(async () => {
  await env.clearFirestore();
});
const initial = (description: string): TariffCatalog => ({
  id: 'main-v1',
  name: 'Mi catálogo',
  createdAt: '2026-10-16',
  updatedAt: '2026-10-16',
  parts: [
    {
      id: 'paint',
      name: 'Pintura',
      concepts: [{ id: 't', description, unit: 'm2', basePrice: 12, cost: 6 }],
    },
  ],
});
it('initializes concurrently without overwriting the winning catalog and is idempotent on retry', async () => {
  const results = await Promise.all([
    adapter.ensureSingleCatalog('alice', initial('A')),
    adapter.ensureSingleCatalog('alice', initial('B')),
  ]);
  expect(results[0]).toEqual(results[1]);
  const db = env.authenticatedContext('alice').firestore();
  expect((await getDocs(collection(db, 'users', 'alice', 'tariffCatalogs'))).size).toBe(1);
  expect(
    (await getDoc(doc(db, 'users', 'alice', 'settings', 'tariffCatalog'))).data()?.activeCatalogId,
  ).toBe('main-v1');
  expect(await adapter.ensureSingleCatalog('alice', initial('C'))).toEqual(results[0]);
});
it('preserves canonical edits during retry and denies initialization in another account', async () => {
  await adapter.ensureSingleCatalog('alice', initial('A'));
  await adapter.updateTariffCatalogDoc('alice', 'main-v1', { parts: initial('Edited').parts });
  expect(
    (await adapter.ensureSingleCatalog('alice', initial('B'))).parts[0]?.concepts[0]?.description,
  ).toBe('Edited');
  await assertFails(adapter.ensureSingleCatalog('bob', initial('B')));
});

it('groups and rewrites an existing flat catalog without losing concept values', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await setDoc(doc(db, 'users', 'alice', 'tariffCatalogs', 'main-v1'), {
    id: 'main-v1',
    name: 'Mi catálogo',
    createdAt: '2026-10-16',
    updatedAt: '2026-10-16',
    tariffs: [
      {
        id: 'water-a',
        description: 'Tubería',
        unit: 'ml',
        basePrice: 30,
        cost: 15,
        category: 'Fontanería',
      },
      {
        id: 'water-b',
        description: 'Desagüe',
        unit: 'ml',
        basePrice: 20,
        cost: 10,
        category: 'Fontanería',
      },
    ],
  });

  const migrated = await adapter.ensureSingleCatalog('alice', initial('Unused'));
  expect(migrated.parts).toHaveLength(1);
  expect(migrated.parts[0]?.concepts.map((concept) => concept.id)).toEqual(['water-b', 'water-a']);
  const stored = (await getDoc(doc(db, 'users', 'alice', 'tariffCatalogs', 'main-v1'))).data();
  expect(stored?.tariffs).toBeUndefined();
  expect(stored?.parts).toEqual(migrated.parts);
});

it('preserves a grouped catalog on retry after migrating the canonical flat document', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await setDoc(doc(db, 'users', 'alice', 'tariffCatalogs', 'main-v1'), {
    id: 'main-v1',
    name: 'Mi catálogo',
    createdAt: '2026-10-16',
    updatedAt: '2026-10-16',
    tariffs: [
      {
        id: 'paint-1',
        description: 'Pintura interior',
        unit: 'm2',
        basePrice: 18,
        cost: 8,
        category: 'Pintura',
      },
      {
        id: 'paint-2',
        description: 'Protección del suelo',
        unit: 'm2',
        basePrice: 4,
        cost: 1,
        category: 'Pintura',
      },
    ],
  });

  const migrated = await adapter.ensureSingleCatalog('alice', initial('Unused'));
  expect(migrated.parts).toHaveLength(1);
  expect(migrated.parts[0]?.concepts.map((concept) => concept.id)).toEqual(['paint-1', 'paint-2']);
  const retry = await adapter.ensureSingleCatalog('alice', initial('Different retry input'));
  expect(retry).toEqual(migrated);
  expect(retry.parts[0]?.concepts.map((concept) => concept.description)).toEqual([
    'Pintura interior',
    'Protección del suelo',
  ]);
});

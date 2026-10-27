import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { user } from './fixtures';

let env: RulesTestEnvironment;
const emulator = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`);
const alice = () => env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
const bob = () => env.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cimbra-rules',
    firestore: {
      host: emulator.hostname,
      port: Number(emulator.port || 8180),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', 'alice'), user());
    await setDoc(doc(context.firestore(), 'users', 'bob'), user('bob'));
  });
});

describe('native FIEBDC document rules', () => {
  it('allows an owner to stage a catalog revision and isolates it from other users', async () => {
    const db = alice();
    await assertSucceeds(
      setDoc(doc(db, 'users/alice/constructionDocuments/catalog-1'), {
        id: 'catalog-1',
        kind: 'catalog',
        state: 'staging',
        createdAt: '2026-10-25T00:00:00.000Z',
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, 'users/alice/constructionDocuments/catalog-1/revisions/rev-1'), {
        id: 'rev-1',
        state: 'staging',
      }),
    );
    await assertSucceeds(
      setDoc(
        doc(db, 'users/alice/constructionDocuments/catalog-1/revisions/rev-1/concepts/concept-1'),
        {
          id: 'concept-1',
          codes: ['A'],
          summary: 'Partida',
        },
      ),
    );
    await assertFails(getDoc(doc(bob(), 'users/alice/constructionDocuments/catalog-1')));
    await assertFails(getDocs(collection(bob(), 'users/alice/constructionDocuments')));
  });

  it('publishes a new budget atomically with exactly one quota increment', async () => {
    const db = alice();
    const root = doc(db, 'users/alice/constructionDocuments/budget-1');
    const revision = doc(db, 'users/alice/constructionDocuments/budget-1/revisions/rev-1');
    await setDoc(root, { id: 'budget-1', kind: 'budget', state: 'staging', createdAt: 'now' });
    await setDoc(revision, { id: 'rev-1', state: 'staging' });
    const batch = writeBatch(db);
    batch.update(root, { state: 'ready', activeRevisionId: 'rev-1', updatedAt: 'now' });
    batch.update(revision, { state: 'ready' });
    batch.update(doc(db, 'users/alice'), {
      totalBudgetsCreated: 1,
      lastCreatedBudgetId: 'budget-1',
    });
    await assertSucceeds(batch.commit());
    await assertFails(
      updateDoc(doc(db, 'users/alice'), {
        totalBudgetsCreated: 2,
        lastCreatedBudgetId: 'budget-1',
      }),
    );
  });
});

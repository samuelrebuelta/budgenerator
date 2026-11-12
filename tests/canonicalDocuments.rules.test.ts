import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import {
  createInTransaction,
  deleteStoredDocument,
  newRootFields,
  readStoredDocument,
  saveStoredDocument,
} from '../src/entities/construction-document/api/storage';
import {
  addChapter,
  addItem,
  updateBusiness,
  type ConstructionDocument,
} from '../src/entities/construction-document/model';
import { sampleDocument, seedBudget, seedStoredDocument, user } from './fixtures';

let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cimbra-canonical',
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), user('alice'));
    await setDoc(doc(ctx.firestore(), 'users', 'bob'), user('bob'));
  });
});
const alice = () =>
  env.authenticatedContext('alice', { email: 'alice@example.test', email_verified: true }).firestore();
const bob = () => env.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();

/** A document large enough to need several 900 KB chunks. */
function bigDocument(kind: ConstructionDocument['kind'], items: number) {
  let document = sampleDocument(kind);
  const chapter = addChapter(document, 'Grande');
  document = chapter.document;
  const text = 'Descripción extensa de la partida. '.repeat(1000);
  for (let index = 0; index < items; index++)
    document = addItem(document, chapter.chapterId, { description: `${index} ${text}` }).document;
  return document;
}

describe('budget creation with the account counter', () => {
  it('creates root and chunks with the next number in one transaction', async () => {
    const db = alice();
    const ref = doc(db, 'users', 'alice', 'budgets', 'b1');
    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(doc(db, 'users', 'alice'));
        const number = (userSnap.data()!.totalBudgetsCreated as number) + 1;
        createInTransaction(transaction, ref, sampleDocument(), {
          ...newRootFields('b1', sampleDocument(), '2026-11-12T10:00:00Z'),
          number,
        });
        transaction.update(doc(db, 'users', 'alice'), {
          totalBudgetsCreated: number,
          lastCreatedBudgetId: 'b1',
        });
      }),
    );
    const stored = await readStoredDocument(ref);
    expect(stored?.root).toMatchObject({ number: 1, revision: 1, contentRevision: 1 });
    expect(stored?.document.business.clientName).toBe('Estudio de prueba');
  });

  it('rejects a forged number, a budget without counter increment and a revision other than 1', async () => {
    const db = alice();
    const attempt = (number: number, revision = 1, increment = true) =>
      runTransaction(db, async (transaction) => {
        const ref = doc(db, 'users', 'alice', 'budgets', `b-${number}-${revision}`);
        createInTransaction(transaction, ref, sampleDocument(), {
          ...newRootFields(ref.id, sampleDocument(), '2026-11-12T10:00:00Z'),
          number,
        });
        if (revision !== 1) transaction.update(ref, { revision });
        if (increment)
          transaction.update(doc(db, 'users', 'alice'), {
            totalBudgetsCreated: 1,
            lastCreatedBudgetId: ref.id,
          });
      });
    await assertFails(attempt(7));
    await assertFails(attempt(1, 1, false));
    await assertFails(attempt(1, 2));
  });
});

describe('optimistic revisions and chunk invariants', () => {
  beforeEach(async () =>
    env.withSecurityRulesDisabled(async (ctx) => seedBudget(ctx.firestore(), 'alice', 'b1')),
  );

  it('saves a new revision and rejects a stale one', async () => {
    const db = alice();
    const ref = doc(db, 'users', 'alice', 'budgets', 'b1');
    const edited = updateBusiness(sampleDocument(), { clientName: 'Nuevo' });
    expect(await saveStoredDocument(db, ref, edited, 1)).toBe(2);
    await expect(saveStoredDocument(db, ref, edited, 1)).rejects.toThrow(/otro dispositivo/);
  });

  it('rejects root bumps without content and chunks that skip the revision', async () => {
    const db = alice();
    await assertFails(
      updateDoc(doc(db, 'users', 'alice', 'budgets', 'b1'), {
        revision: 2,
        contentRevision: 2,
        updatedAt: 'x',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'users', 'alice', 'budgets', 'b1', 'content', '0'), {
        index: 0,
        revision: 1,
        data: '{}',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'users', 'alice', 'budgets', 'b1'), { revision: 5, updatedAt: 'x' }),
    );
    await assertFails(
      updateDoc(doc(db, 'users', 'alice', 'budgets', 'b1'), {
        revision: 2,
        ivaRate: 3,
        updatedAt: 'x',
      }),
    );
  });

  it('spreads large documents over several chunks and shrinks them atomically', async () => {
    const db = alice();
    const ref = doc(db, 'users', 'alice', 'budgets', 'b1');
    const big = bigDocument('budget', 60);
    await assertSucceeds(saveStoredDocument(db, ref, big, 1));
    const stored = await readStoredDocument(ref);
    expect(stored!.root.chunkCount).toBeGreaterThan(1);
    expect(stored!.document.tree).toEqual(big.tree);
    await assertSucceeds(saveStoredDocument(db, ref, sampleDocument(), 2));
    expect((await getDoc(ref)).data()?.chunkCount).toBe(1);
    expect((await getDoc(doc(db, 'users', 'alice', 'budgets', 'b1', 'content', '1'))).exists()).toBe(
      false,
    );
  });

  it('isolates documents per account and deletes root and chunks together', async () => {
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'budgets', 'b1')));
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'budgets', 'b1', 'content', '0')));
    const intruder = bob();
    await assertFails(
      saveStoredDocument(
        intruder,
        doc(intruder, 'users', 'alice', 'budgets', 'b1'),
        sampleDocument(),
        1,
      ),
    );
    await assertFails(deleteDoc(doc(alice(), 'users', 'alice', 'budgets', 'b1', 'content', '0')));
    const db = alice();
    await assertSucceeds(deleteStoredDocument(db, doc(db, 'users', 'alice', 'budgets', 'b1')));
    expect((await getDoc(doc(db, 'users', 'alice', 'budgets', 'b1', 'content', '0'))).exists()).toBe(
      false,
    );
  });
});

describe('templates and the single catalog', () => {
  it('creates, edits and deletes templates without quota', async () => {
    const db = alice();
    const ref = doc(db, 'users', 'alice', 'templates', 't1');
    const template = sampleDocument('template');
    await assertSucceeds(
      runTransaction(db, async (transaction) =>
        createInTransaction(transaction, ref, template, newRootFields('t1', template, 'now')),
      ),
    );
    await assertSucceeds(
      saveStoredDocument(db, ref, updateBusiness(template, { name: 'Baño' }), 1),
    );
    await assertFails(updateDoc(ref, { number: 3, revision: 3, updatedAt: 'x' }));
    await assertSucceeds(deleteStoredDocument(db, ref));
    expect((await getDoc(doc(alice(), 'users', 'alice'))).data()?.totalBudgetsCreated).toBe(0);
  });

  it('allows only catalog/main with kind catalog and never deletes it', async () => {
    const db = alice();
    const catalog = sampleDocument('catalog');
    const create = (id: string, document: ConstructionDocument) =>
      runTransaction(db, async (transaction) => {
        const ref = doc(db, 'users', 'alice', 'catalog', id);
        createInTransaction(transaction, ref, document, newRootFields(id, document, 'now'));
      });
    await assertFails(create('other', catalog));
    await assertFails(create('main', sampleDocument('budget')));
    await assertSucceeds(create('main', catalog));
    const ref = doc(db, 'users', 'alice', 'catalog', 'main');
    await assertSucceeds(saveStoredDocument(db, ref, bigDocument('catalog', 40), 1));
    await assertFails(deleteDoc(ref));
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'catalog', 'main')));
  });

  it('keeps legacy flat collections closed', async () => {
    const db = alice();
    await assertFails(setDoc(doc(db, 'users', 'alice', 'tariffCatalogs', 'main-v1'), { parts: [] }));
    await assertFails(setDoc(doc(db, 'users', 'alice', 'tariffs', 'x'), { description: 'x' }));
    await env.withSecurityRulesDisabled(async (ctx) =>
      seedStoredDocument(ctx.firestore(), ['users', 'alice', 'templates', 't'], sampleDocument('template')),
    );
    await assertSucceeds(getDoc(doc(db, 'users', 'alice', 'templates', 't', 'content', '0')));
  });
});

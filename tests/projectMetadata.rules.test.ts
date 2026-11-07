import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;
const owner = () => env.authenticatedContext('alice').firestore();
const otherUser = () => env.authenticatedContext('bob').firestore();
const projectId = 'project-1';
const budgetId = 'budget-1';
const projectPath = ['users', 'alice', 'projects', projectId] as const;
const budgetPath = ['users', 'alice', 'budgets', budgetId] as const;
const acceptedAt = '2026-11-01T10:00:00.000Z';

beforeAll(async () => {
  const firestoreEmulator = new URL(
    `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
  );
  env = await initializeTestEnvironment({
    projectId: 'demo-bg009-project-metadata',
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
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'alice'), { uid: 'alice' });
    await setDoc(doc(db, 'users', 'bob'), { uid: 'bob' });
    await setDoc(doc(db, ...projectPath), {
      id: projectId,
      sourceBudgetId: budgetId,
      sourceBudgetNumber: '01',
      title: 'Obra original',
      clientName: 'Cliente original',
      address: 'Obra original',
      acceptedAt,
      createdAt: acceptedAt,
    });
    await setDoc(doc(db, ...budgetPath), {
      id: budgetId,
      info: {
        clientName: 'Cliente original',
        address: 'Obra original',
        date: '2026-11-01',
        budgetNumber: '01',
      },
      workItems: [],
      acceptedAt,
      projectId,
      createdAt: acceptedAt,
    });
  });
});

describe('project and source budget metadata rules', () => {
  it('allows the owner to update matching project and budget metadata atomically', async () => {
    const db = owner();
    const batch = writeBatch(db);
    batch.update(doc(db, ...projectPath), {
      title: 'Reforma renovada',
      address: 'Reforma renovada',
      clientName: 'Cliente renovado',
    });
    batch.update(doc(db, ...budgetPath), {
      'info.address': 'Reforma renovada',
      'info.clientName': 'Cliente renovado',
    });

    await assertSucceeds(batch.commit());
  });

  it('denies updates to only one linked document', async () => {
    const db = owner();
    await assertFails(
      updateDoc(doc(db, ...projectPath), {
        title: 'Reforma renovada',
        address: 'Reforma renovada',
      }),
    );
    await assertFails(updateDoc(doc(db, ...budgetPath), { 'info.clientName': 'Cliente renovado' }));
  });

  it('denies mismatched values, unrelated project fields, and other accounts', async () => {
    const db = owner();
    const mismatch = writeBatch(db);
    mismatch.update(doc(db, ...projectPath), {
      title: 'Otro nombre',
      address: 'Otro nombre',
      clientName: 'Cliente renovado',
    });
    mismatch.update(doc(db, ...budgetPath), {
      'info.address': 'Nombre diferente',
      'info.clientName': 'Cliente renovado',
    });
    await assertFails(mismatch.commit());

    const extraField = writeBatch(db);
    extraField.update(doc(db, ...projectPath), {
      title: 'Reforma renovada',
      address: 'Reforma renovada',
      clientName: 'Cliente renovado',
      status: 'completed',
    });
    extraField.update(doc(db, ...budgetPath), {
      'info.address': 'Reforma renovada',
      'info.clientName': 'Cliente renovado',
    });
    await assertFails(extraField.commit());

    const foreignDb = otherUser();
    const foreignBatch = writeBatch(foreignDb);
    foreignBatch.update(doc(foreignDb, ...projectPath), {
      title: 'Reforma renovada',
      address: 'Reforma renovada',
      clientName: 'Cliente renovado',
    });
    foreignBatch.update(doc(foreignDb, ...budgetPath), {
      'info.address': 'Reforma renovada',
      'info.clientName': 'Cliente renovado',
    });
    await assertFails(foreignBatch.commit());
  });
});

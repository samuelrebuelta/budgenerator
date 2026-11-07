import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { createProjectFirestoreApi } from '../src/entities/project/api/firestore';

let env: RulesTestEnvironment;
const projectRefPath = ['users', 'alice', 'projects', 'project-1'] as const;
const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();

beforeAll(async () => {
  const firestoreEmulator = new URL(
    `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
  );
  env = await initializeTestEnvironment({
    projectId: 'demo-bg011-estimated-end-date',
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
    await setDoc(doc(db, ...projectRefPath), {
      id: 'project-1',
      sourceBudgetId: 'budget-1',
      createdAt: '2026-11-01T10:00:00.000Z',
      title: 'Cocina',
      status: 'in_progress',
      percent: 40,
    });
  });
});

describe('project estimated end date Firestore boundary', () => {
  it('allows the owner to set and adjust only the estimated end date', async () => {
    const ref = doc(alice(), ...projectRefPath);
    await assertSucceeds(updateDoc(ref, { estimatedEndDate: '2026-11-30' }));
    await assertSucceeds(updateDoc(ref, { estimatedEndDate: '2026-12-15' }));
  });

  it('denies another account and mixed project-field updates', async () => {
    await assertFails(updateDoc(doc(bob(), ...projectRefPath), { estimatedEndDate: '2026-11-30' }));
    await assertFails(
      updateDoc(doc(alice(), ...projectRefPath), {
        estimatedEndDate: '2026-11-30',
        status: 'completed',
      }),
    );
  });

  it('rejects a malformed date and validates real dates in the client API', async () => {
    await assertFails(
      updateDoc(doc(alice(), ...projectRefPath), { estimatedEndDate: '30/11/2026' }),
    );

    const api = createProjectFirestoreApi(alice());
    const setEstimatedEndDate = Reflect.get(api, 'setEstimatedEndDate') as
      ((uid: string, projectId: string, value: string) => Promise<void>) | undefined;
    expect(typeof setEstimatedEndDate).toBe('function');
    if (typeof setEstimatedEndDate !== 'function') return;

    await expect(setEstimatedEndDate('alice', 'project-1', '2026-02-30')).rejects.toThrow(
      'La fecha estimada de fin no es válida.',
    );
  });
});

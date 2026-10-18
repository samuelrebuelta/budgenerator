import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { createProjectFirestoreApi } from '../src/entities/project/api/firestore';
import type { Project, ProjectWorkItem } from '../src/entities/project/model/types';
import { budget, user } from './fixtures';

let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);
const projectId = 'project-1';
const project = (): Project => ({
  id: projectId,
  sourceBudgetId: 'source',
  sourceBudgetNumber: '8',
  title: 'Reforma de prueba',
  clientName: 'Cliente',
  address: 'Madrid',
  budgetDate: '2026-10-10',
  acceptedAt: '2026-10-11T10:00:00.000Z',
  createdAt: '2026-10-11T10:00:00.000Z',
  subtotal: 100,
  iva: 21,
  total: 121,
  ivaRate: 0.21,
  adjustment: { multiplier: 1.2, reason: 'Ajuste original' },
  workItemCount: 1,
  mode: 'amount',
  totalConcepts: 1,
  completedConcepts: 1,
  totalAmount: 100,
  completedAmount: 100,
  percent: 100,
  status: 'completed',
  completedAt: '2026-10-17T12:00:00.000Z',
  supplementsSubtotal: 0,
  supplementsIva: 0,
  updatedTotal: 121,
});
const workItem = (): ProjectWorkItem => ({
  id: 'original-work',
  name: 'Albañilería',
  position: 0,
  tasks: [
    {
      id: 'original-task',
      description: 'Reparar pared',
      quantity: 1,
      unit: 'unit',
      price: 100,
      cost: 30,
      completedAt: '2026-10-17T12:00:00.000Z',
    },
  ],
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cimbra-project-supplements',
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
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'alice'), { ...user('alice'), totalBudgetsCreated: 1 });
    await setDoc(doc(db, 'users', 'bob'), user('bob'));
    await setDoc(doc(db, 'users', 'alice', 'budgets', 'source'), {
      ...budget('source'),
      acceptedAt: '2026-10-11T10:00:00.000Z',
      ivaRate: 0.21,
      adjustment: { multiplier: 1.2, reason: 'Ajuste original' },
    });
    await setDoc(doc(db, 'users', 'alice', 'projects', projectId), project());
    await setDoc(
      doc(db, 'users', 'alice', 'projects', projectId, 'workItems', 'original-work'),
      workItem(),
    );
  });
});
const alice = () => env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
const bob = () => env.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();
const supplementInput = {
  description: 'Punto de luz adicional',
  quantity: 2,
  unit: 'unit',
  unitPrice: 20,
};

describe('project supplement transactions', () => {
  it('adds an accepted-project VAT supplement atomically and reopens a completed project', async () => {
    const db = alice();
    const api = createProjectFirestoreApi(db);
    const result = await api.addSupplement('alice', projectId, 'extra-light', supplementInput);

    expect(result.supplement).toMatchObject({ subtotal: 40, iva: 8.4, total: 48.4 });
    expect(result.project).toMatchObject({
      subtotal: 100,
      iva: 21,
      total: 121,
      supplementsSubtotal: 40,
      supplementsIva: 8.4,
      updatedTotal: 169.4,
      totalConcepts: 2,
      completedConcepts: 1,
      totalAmount: 140,
      completedAmount: 100,
      percent: 71,
      status: 'in_progress',
    });
    expect(result.workItem.tasks[0]?.completedAt).toBeUndefined();
    const originalBudget = (await getDoc(doc(db, 'users', 'alice', 'budgets', 'source'))).data();
    expect(originalBudget?.workItems[0]?.tasks[0]?.price).toBe(10.75);
    expect(originalBudget?.adjustment).toEqual({ multiplier: 1.2, reason: 'Ajuste original' });
    expect(
      (
        await getDoc(doc(db, 'users', 'alice', 'projects', projectId, 'supplements', 'extra-light'))
      ).exists(),
    ).toBe(true);
  });

  it('retries the same supplement ID once without duplicate amount or work', async () => {
    const db = alice();
    const api = createProjectFirestoreApi(db);
    await api.addSupplement('alice', projectId, 'extra-light', supplementInput);
    const retried = await api.addSupplement('alice', projectId, 'extra-light', supplementInput);

    expect(retried.project.updatedTotal).toBe(169.4);
    expect(
      (await getDocs(collection(db, 'users', 'alice', 'projects', projectId, 'supplements'))).size,
    ).toBe(1);
    expect(
      (await getDocs(collection(db, 'users', 'alice', 'projects', projectId, 'workItems'))).size,
    ).toBe(2);
  });

  it('voids a supplement with a reason and removes its amount and work from progress', async () => {
    const db = alice();
    const api = createProjectFirestoreApi(db);
    await api.addSupplement('alice', projectId, 'extra-light', supplementInput);
    const result = await api.voidSupplement(
      'alice',
      projectId,
      'extra-light',
      'El cliente ya no necesita ese punto de luz.',
    );

    expect(result.project).toMatchObject({
      subtotal: 100,
      iva: 21,
      total: 121,
      supplementsSubtotal: 0,
      supplementsIva: 0,
      updatedTotal: 121,
      totalConcepts: 1,
      completedConcepts: 1,
      totalAmount: 100,
      completedAmount: 100,
      percent: 100,
      status: 'completed',
    });
    expect(result.supplementVoid.reason).toBe('El cliente ya no necesita ese punto de luz.');
    expect(result.workItem.voidedAt).toBeTruthy();
    expect(
      (
        await getDoc(doc(db, 'users', 'alice', 'projects', projectId, 'supplements', 'extra-light'))
      ).exists(),
    ).toBe(true);
  });

  it('rejects partial or malformed records and denies another account access', async () => {
    const db = alice();
    const supplementRef = doc(db, 'users', 'alice', 'projects', projectId, 'supplements', 'forged');
    await assertFails(setDoc(supplementRef, { id: 'forged', description: '' }));
    await assertFails(
      getDoc(doc(bob(), 'users', 'alice', 'projects', projectId, 'supplements', 'forged')),
    );
    await assertFails(
      setDoc(doc(bob(), 'users', 'alice', 'projects', projectId, 'supplements', 'other'), {
        id: 'other',
      }),
    );
    await assertSucceeds(getDoc(doc(db, 'users', 'alice', 'projects', projectId)));
  });

  it('keeps supplements and voids immutable and requires an atomic void', async () => {
    const db = alice();
    const api = createProjectFirestoreApi(db);
    await api.addSupplement('alice', projectId, 'extra-light', supplementInput);
    const supplementRef = doc(
      db,
      'users',
      'alice',
      'projects',
      projectId,
      'supplements',
      'extra-light',
    );
    const voidRef = doc(
      db,
      'users',
      'alice',
      'projects',
      projectId,
      'supplementVoids',
      'extra-light',
    );
    await assertFails(updateDoc(supplementRef, { description: 'Cambio' }));
    await assertFails(deleteDoc(supplementRef));
    await assertFails(
      setDoc(voidRef, {
        supplementId: 'extra-light',
        reason: 'Anulación sin actualizar el proyecto',
        voidedAt: '2026-10-18T12:00:00.000Z',
      }),
    );
    await api.voidSupplement('alice', projectId, 'extra-light', 'Motivo válido');
    await assertFails(updateDoc(voidRef, { reason: 'Cambio' }));
    await assertFails(deleteDoc(voidRef));
  });
});

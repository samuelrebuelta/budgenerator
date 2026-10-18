import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import type { Budget } from '../src/shared/types';
import { createBudgetAcceptanceApi } from '../src/entities/budget/api/acceptance';
import { createProjectFirestoreApi } from '../src/entities/project/api/firestore';
import { budget, user } from './fixtures';

let env: RulesTestEnvironment;
const acceptedAt = '2026-10-18T09:00:00.000Z';
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cimbra-project-conversion',
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
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), {
      ...user('alice'),
      totalBudgetsCreated: 1,
      budgetSlotsReleased: 1,
    });
    await setDoc(doc(ctx.firestore(), 'users', 'bob'), user('bob'));
    await setDoc(doc(ctx.firestore(), 'users', 'alice', 'budgets', 'source'), budget('source'));
  });
});
const alice = () => env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function tomorrowDateKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localDateKey(tomorrow);
}

describe('accepted budget conversion', () => {
  it('allows acceptance to be withdrawn before conversion', async () => {
    const db = alice();
    const acceptance = createBudgetAcceptanceApi(db);
    await acceptance.acceptBudget('alice', 'source', acceptedAt);
    expect((await getDoc(doc(db, 'users', 'alice', 'budgets', 'source'))).data()?.acceptedAt).toBe(
      acceptedAt,
    );

    await acceptance.withdrawBudgetAcceptance('alice', 'source');
    expect(
      (await getDoc(doc(db, 'users', 'alice', 'budgets', 'source'))).data()?.acceptedAt,
    ).toBeUndefined();
  });

  it('returns the same project for concurrent conversion without changing quota', async () => {
    const db = alice();
    await createBudgetAcceptanceApi(db).acceptBudget('alice', 'source', acceptedAt);
    const api = createProjectFirestoreApi(db);

    const ids = await Promise.all([
      api.convertBudgetToProject('alice', 'source'),
      api.convertBudgetToProject('alice', 'source'),
    ]);
    const retriedId = await api.convertBudgetToProject('alice', 'source');

    expect(ids[0]).toBe(ids[1]);
    expect(retriedId).toBe(ids[0]);
    expect((await getDocs(collection(db, 'users', 'alice', 'projects'))).size).toBe(1);
    expect(
      (await getDocs(collection(db, 'users', 'alice', 'projects', ids[0]!, 'workItems'))).size,
    ).toBe(1);
    expect((await getDoc(doc(db, 'users', 'alice'))).data()).toMatchObject({
      totalBudgetsCreated: 1,
      budgetSlotsReleased: 1,
    });
    expect((await getDoc(doc(db, 'users', 'alice'))).data()?.lastConvertedBudgetId).toBeUndefined();
    expect((await getDoc(doc(db, 'users', 'alice', 'budgets', 'source'))).data()?.projectId).toBe(
      ids[0],
    );
  });

  it('keeps the project snapshot independent when the source changes outside the client rules', async () => {
    const db = alice();
    await createBudgetAcceptanceApi(db).acceptBudget('alice', 'source', acceptedAt);
    const api = createProjectFirestoreApi(db);
    const projectId = await api.convertBudgetToProject('alice', 'source');

    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'alice', 'budgets', 'source'), {
        'info.address': 'Dirección modificada',
        'workItems.0.tasks.0.price': 999,
      });
    });

    const project = await api.fetchProject('alice', projectId);
    expect(project?.address).toBe('Proyecto de demostración');
    expect(project?.workItems[0]?.tasks[0]?.price).toBe(10.75);
  });

  it('updates concept, work-item, and project progress atomically', async () => {
    const db = alice();
    await createBudgetAcceptanceApi(db).acceptBudget('alice', 'source', acceptedAt);
    const api = createProjectFirestoreApi(db);
    const projectId = await api.convertBudgetToProject('alice', 'source');

    const completed = await api.toggleTask('alice', projectId, 'work', 'task');
    expect(completed.project).toMatchObject({
      completedConcepts: 1,
      completedAmount: 26.88,
      percent: 100,
      status: 'completed',
    });
    expect(completed.project.completedAt).toBeTruthy();
    expect(completed.workItem.tasks[0]?.completedAt).toBeTruthy();

    const reopened = await api.toggleTask('alice', projectId, 'work', 'task');
    expect(reopened.project).toMatchObject({
      completedConcepts: 0,
      completedAmount: 0,
      percent: 0,
      status: 'pending',
    });
    expect(reopened.project.completedAt).toBeUndefined();
    expect(reopened.workItem.tasks[0]?.completedAt).toBeUndefined();

    const wholeWorkItem = await api.completeWorkItem('alice', projectId, 'work');
    expect(wholeWorkItem.project.status).toBe('completed');
    expect(wholeWorkItem.workItem.tasks.every((task) => task.completedAt)).toBe(true);
    expect((await api.fetchProject('alice', projectId))?.percent).toBe(100);
  });

  it('allows the owner to edit completed dates and recalculates the project completion date', async () => {
    const db = alice();
    const source = budget('source');
    const firstWorkItem = source.workItems[0]!;
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'users', 'alice', 'budgets', 'source'), {
        ...source,
        workItems: [
          {
            ...firstWorkItem,
            tasks: [
              ...firstWorkItem.tasks,
              {
                ...firstWorkItem.tasks[0]!,
                id: 'task-2',
                description: 'Segundo concepto',
                price: 20,
              },
            ],
          },
        ],
      }),
    );
    await createBudgetAcceptanceApi(db).acceptBudget('alice', 'source', acceptedAt);
    const api = createProjectFirestoreApi(db);
    const projectId = await api.convertBudgetToProject('alice', 'source');

    await expect(
      api.setTaskCompletionDate('alice', projectId, 'work', 'task', '2020-05-04'),
    ).rejects.toThrow();

    const completed = await api.completeWorkItem('alice', projectId, 'work');
    const corrected = await api.setTaskCompletionDate(
      'alice',
      projectId,
      'work',
      'task',
      '2020-05-04',
    );
    expect(corrected.workItem.tasks[0]?.completedAt).toBe('2020-05-04');
    expect(corrected.project.completedAt).toBe(
      localDateKey(new Date(completed.workItem.tasks[1]!.completedAt!)),
    );
    expect(corrected.project).toMatchObject({ completedConcepts: 2, status: 'completed' });

    const wholeWorkItem = await api.setWorkItemCompletionDate(
      'alice',
      projectId,
      'work',
      '2020-05-05',
    );
    expect(wholeWorkItem.workItem.tasks).toHaveLength(2);
    expect(wholeWorkItem.workItem.tasks.every((task) => task.completedAt === '2020-05-05')).toBe(
      true,
    );
    expect(wholeWorkItem.project.completedAt).toBe('2020-05-05');

    await expect(
      api.setTaskCompletionDate('alice', projectId, 'work', 'task', tomorrowDateKey()),
    ).rejects.toThrow(/futura/i);
    expect((await api.fetchProject('alice', projectId))?.completedAt).toBe('2020-05-05');

    const foreignDb = env.authenticatedContext('bob').firestore();
    const persisted = await api.fetchProject('alice', projectId);
    const editedTasks = persisted!.workItems[0]!.tasks.map((task) => ({
      ...task,
      completedAt: '2020-05-06',
    }));
    await expect(
      updateDoc(doc(foreignDb, 'users', 'alice', 'projects', projectId, 'workItems', 'work'), {
        tasks: editedTasks,
      }),
    ).rejects.toThrow();
    expect((await api.fetchProject('alice', projectId))?.completedAt).toBe('2020-05-05');

    await api.addSupplement('alice', projectId, 'extra-date', {
      description: 'Concepto añadido',
      quantity: 1,
      unit: 'unit',
      unitPrice: 10,
    });
    const voided = await api.voidSupplement('alice', projectId, 'extra-date', 'Trabajo cancelado');
    expect(voided.project.status).toBe('completed');
    expect(voided.project.completedAt).toBe('2020-05-05');
  });

  it('converts a budget with 200 work items in one atomic operation', async () => {
    const workItems = Array.from({ length: 200 }, (_, index) => ({
      id: `part-${index}`,
      name: `Partida ${index}`,
      tasks: [
        {
          id: `task-${index}`,
          description: `Concepto ${index}`,
          quantity: 1,
          unit: 'unit' as const,
          price: 1,
          cost: 0,
        },
      ],
    }));
    const source: Budget = { ...budget('source'), acceptedAt, workItems };
    const db = alice();
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'users', 'alice', 'budgets', 'source'), source),
    );

    const projectId = await createProjectFirestoreApi(db).convertBudgetToProject('alice', 'source');

    expect(
      (await getDocs(collection(db, 'users', 'alice', 'projects', projectId, 'workItems'))).size,
    ).toBe(200);
  });

  it('rejects a source with no concepts without leaving project records or releasing quota', async () => {
    const empty: Budget = {
      ...budget('source'),
      acceptedAt,
      workItems: [{ id: 'empty', name: 'Vacía', tasks: [] }],
    };
    const db = alice();
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'users', 'alice', 'budgets', 'source'), empty),
    );

    await expect(
      createProjectFirestoreApi(db).convertBudgetToProject('alice', 'source'),
    ).rejects.toThrow();
    expect((await getDocs(collection(db, 'users', 'alice', 'projects'))).size).toBe(0);
    expect((await getDoc(doc(db, 'users', 'alice'))).data()?.budgetSlotsReleased).toBe(1);
  });
});

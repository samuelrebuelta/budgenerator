import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { createBudgetAcceptanceApi } from '../src/entities/budget/api/acceptance';
import { createProjectFirestoreApi } from '../src/entities/project/api/firestore';
import { sampleDocument, seedBudget, user } from './fixtures';
import {
  addChapter,
  addItem,
  createEmptyDocument,
} from '../src/entities/construction-document/model';
import { saveStoredDocument } from '../src/entities/construction-document/api/storage';

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
    await seedBudget(ctx.firestore(), 'alice', 'source');
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

const WORK = 'n1';
const TASK = 'n2';

describe('accepted budget conversion', () => {
  it('allows acceptance to be withdrawn before conversion', async () => {
    const db = alice();
    const acceptance = createBudgetAcceptanceApi(db);
    await acceptance.acceptBudget('alice', 'source', acceptedAt, 1);
    expect((await getDoc(doc(db, 'users', 'alice', 'budgets', 'source'))).data()).toMatchObject({
      acceptedAt,
      revision: 2,
    });
    await acceptance.withdrawBudgetAcceptance('alice', 'source');
    expect(
      (await getDoc(doc(db, 'users', 'alice', 'budgets', 'source'))).data()?.acceptedAt,
    ).toBeUndefined();
  });

  it('returns the same project for concurrent conversion without changing quota', async () => {
    const db = alice();
    await createBudgetAcceptanceApi(db).acceptBudget('alice', 'source', acceptedAt, 1);
    const api = createProjectFirestoreApi(db);
    const results = await Promise.all([
      api.convertBudgetToProject('alice', 'source'),
      api.convertBudgetToProject('alice', 'source'),
    ]);
    const retried = await api.convertBudgetToProject('alice', 'source');
    expect(results[0]!.projectId).toBe(results[1]!.projectId);
    expect(retried.projectId).toBe(results[0]!.projectId);
    expect((await getDocs(collection(db, 'users', 'alice', 'projects'))).size).toBe(1);
    expect((await getDoc(doc(db, 'users', 'alice'))).data()).toMatchObject({
      totalBudgetsCreated: 1,
    });
    expect((await getDoc(doc(db, 'users', 'alice', 'budgets', 'source'))).data()).toMatchObject({
      projectId: results[0]!.projectId,
      revision: 3,
    });
  });

  it('reads the project structure from the locked budget document', async () => {
    const db = alice();
    await createBudgetAcceptanceApi(db).acceptBudget('alice', 'source', acceptedAt, 1);
    const api = createProjectFirestoreApi(db);
    const { projectId } = await api.convertBudgetToProject('alice', 'source');
    await expect(
      saveStoredDocument(db, doc(db, 'users', 'alice', 'budgets', 'source'), sampleDocument(), 3),
    ).rejects.toThrow();
    const project = await api.fetchProject('alice', projectId);
    expect(project?.address).toBe('Proyecto de demostración');
    expect(project?.workItems[0]).toMatchObject({ id: WORK, name: 'Pintura' });
    expect(project?.workItems[0]?.tasks[0]).toMatchObject({
      id: TASK,
      price: 10.75,
      quantity: 2.5,
    });
  });

  it('updates item progress and the project summary atomically', async () => {
    const db = alice();
    await createBudgetAcceptanceApi(db).acceptBudget('alice', 'source', acceptedAt, 1);
    const api = createProjectFirestoreApi(db);
    const { projectId } = await api.convertBudgetToProject('alice', 'source');

    const completed = await api.toggleTask('alice', projectId, WORK, TASK);
    expect(completed.project).toMatchObject({
      completedConcepts: 1,
      completedAmount: 26.88,
      percent: 100,
      status: 'completed',
    });
    expect(completed.workItem.tasks[0]?.completedAt).toBeTruthy();
    const state = await getDoc(
      doc(db, 'users', 'alice', 'projects', projectId, 'progress', 'state'),
    );
    expect(Object.keys(state.data()?.completed ?? {})).toEqual([TASK]);

    const reopened = await api.toggleTask('alice', projectId, WORK, TASK);
    expect(reopened.project).toMatchObject({ completedConcepts: 0, status: 'pending' });
    expect(reopened.project.completedAt).toBeUndefined();

    const whole = await api.completeWorkItem('alice', projectId, WORK);
    expect(whole.project.status).toBe('completed');
    expect((await api.fetchProject('alice', projectId))?.percent).toBe(100);
  });

  it('allows the owner to edit completed dates and recalculates the project completion date', async () => {
    const db = alice();
    let document = createEmptyDocument('budget', {
      clientName: 'Cliente',
      address: 'Obra',
      date: '2026-10-14',
    });
    const chapter = addChapter(document, 'Pintura');
    document = addItem(chapter.document, chapter.chapterId, {
      description: 'Uno',
      quantity: 1,
      price: 10,
    }).document;
    document = addItem(document, chapter.chapterId, {
      description: 'Dos',
      quantity: 1,
      price: 20,
    }).document;
    await env.withSecurityRulesDisabled(async (ctx) =>
      seedBudget(ctx.firestore(), 'alice', 'source', {}, document),
    );
    const work = document.tree[0]!.id;
    const [first, second] = document.tree[0]!.children.map((node) => node.id);
    await createBudgetAcceptanceApi(db).acceptBudget('alice', 'source', acceptedAt, 1);
    const api = createProjectFirestoreApi(db);
    const { projectId } = await api.convertBudgetToProject('alice', 'source');

    await expect(
      api.setTaskCompletionDate('alice', projectId, work, first!, '2020-05-04'),
    ).rejects.toThrow();
    const completed = await api.completeWorkItem('alice', projectId, work);
    const corrected = await api.setTaskCompletionDate(
      'alice',
      projectId,
      work,
      first!,
      '2020-05-04',
    );
    expect(corrected.workItem.tasks[0]?.completedAt).toBe('2020-05-04');
    expect(corrected.project.completedAt).toBe(
      localDateKey(new Date(completed.workItem.tasks[1]!.completedAt!)),
    );
    const whole = await api.setWorkItemCompletionDate('alice', projectId, work, '2020-05-05');
    expect(whole.workItem.tasks.every((task) => task.completedAt === '2020-05-05')).toBe(true);
    expect(whole.project.completedAt).toBe('2020-05-05');
    await expect(
      api.setTaskCompletionDate('alice', projectId, work, second!, tomorrowDateKey()),
    ).rejects.toThrow(/futura/i);

    const foreignDb = env.authenticatedContext('bob').firestore();
    await expect(
      setDoc(doc(foreignDb, 'users', 'alice', 'projects', projectId, 'progress', 'state'), {
        completed: {},
        updatedAt: 'x',
      }),
    ).rejects.toThrow();

    await api.addSupplement('alice', projectId, 'extra-date', {
      description: 'Concepto añadido',
      quantity: 1,
      unit: 'ud',
      unitPrice: 10,
    });
    const voided = await api.voidSupplement('alice', projectId, 'extra-date', 'Trabajo cancelado');
    expect(voided.project.status).toBe('completed');
    expect(voided.project.completedAt).toBe('2020-05-05');
  });

  it('converts a budget with 200 chapters in one atomic operation', async () => {
    let document = createEmptyDocument('budget', { clientName: 'C', address: 'Obra' });
    for (let index = 0; index < 200; index++) {
      const chapter = addChapter(document, `Capítulo ${index}`);
      document = addItem(chapter.document, chapter.chapterId, {
        description: `Partida ${index}`,
        quantity: 1,
        price: 1,
      }).document;
    }
    await env.withSecurityRulesDisabled(async (ctx) =>
      seedBudget(ctx.firestore(), 'alice', 'source', { acceptedAt }, document),
    );
    const api = createProjectFirestoreApi(alice());
    const { projectId } = await api.convertBudgetToProject('alice', 'source');
    const project = await api.fetchProject('alice', projectId);
    expect(project?.workItems).toHaveLength(200);
    expect(project?.totalConcepts).toBe(200);
  });

  it('rejects a source with no items without leaving project records', async () => {
    let document = createEmptyDocument('budget', { clientName: 'C', address: 'Obra' });
    document = addChapter(document, 'Vacía').document;
    await env.withSecurityRulesDisabled(async (ctx) =>
      seedBudget(ctx.firestore(), 'alice', 'source', { acceptedAt }, document),
    );
    const db = alice();
    await expect(
      createProjectFirestoreApi(db).convertBudgetToProject('alice', 'source'),
    ).rejects.toThrow();
    expect((await getDocs(collection(db, 'users', 'alice', 'projects'))).size).toBe(0);
  });
});

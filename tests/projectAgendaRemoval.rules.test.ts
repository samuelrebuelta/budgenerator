import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { createProjectFirestoreApi } from '../src/entities/project/api/firestore';
import type { Project, ProjectWorkItem } from '../src/entities/project/model/types';
import { budget, user } from './fixtures';

let env: RulesTestEnvironment;
const emulator = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`);
const projectId = 'project-agenda-removal';

const project = (): Project => ({
  id: projectId,
  sourceBudgetId: 'source',
  sourceBudgetNumber: '21',
  title: 'Reforma de prueba',
  clientName: 'Cliente de prueba',
  address: 'Madrid',
  budgetDate: '2026-10-10',
  acceptedAt: '2026-10-11T10:00:00.000Z',
  createdAt: '2026-10-11T10:00:00.000Z',
  subtotal: 100,
  iva: 21,
  total: 121,
  ivaRate: 0.21,
  workItemCount: 1,
  mode: 'amount',
  totalConcepts: 2,
  completedConcepts: 0,
  totalAmount: 100,
  completedAmount: 0,
  percent: 0,
  status: 'pending',
  supplementsSubtotal: 0,
  supplementsIva: 0,
  updatedTotal: 121,
});

const workItem = (): ProjectWorkItem => ({
  id: 'work-paint',
  name: 'Pintura',
  position: 0,
  tasks: [
    { id: 'walls', description: 'Paredes', quantity: 1, unit: 'unit', price: 50, cost: 20 },
    { id: 'ceiling', description: 'Techo', quantity: 1, unit: 'unit', price: 50, cost: 20 },
  ],
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bg011-agenda-removal',
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
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'alice'), { ...user('alice'), totalBudgetsCreated: 1 });
    await setDoc(doc(db, 'users', 'alice', 'budgets', 'source'), budget('source'));
    await setDoc(doc(db, 'users', 'alice', 'projects', projectId), project());
    await setDoc(
      doc(db, 'users', 'alice', 'projects', projectId, 'workItems', 'work-paint'),
      workItem(),
    );
  });
});

const alice = () => env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();

describe('retired project agenda', () => {
  it('keeps project progress and completion dates without creating milestone records', async () => {
    const db = alice();
    const api = createProjectFirestoreApi(db);

    await api.toggleTask('alice', projectId, 'work-paint', 'walls');
    const completion = await api.toggleTask('alice', projectId, 'work-paint', 'ceiling');

    expect(completion.project).toMatchObject({
      completedConcepts: 2,
      completedAmount: 100,
      percent: 100,
      status: 'completed',
    });
    expect(completion.project.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(completion.workItem.latestMilestoneId).toBeUndefined();
    let agendaAfterCompletionSize = -1;
    await env.withSecurityRulesDisabled(async (context) => {
      agendaAfterCompletionSize = (
        await getDocs(collection(context.firestore(), 'users', 'alice', 'projectAgenda'))
      ).size;
    });
    expect(agendaAfterCompletionSize).toBe(0);

    await api.setWorkItemCompletionDate('alice', projectId, 'work-paint', '2026-10-20');
    const updatedProject = await getDoc(doc(db, 'users', 'alice', 'projects', projectId));
    const updatedWorkItem = await getDoc(
      doc(db, 'users', 'alice', 'projects', projectId, 'workItems', 'work-paint'),
    );
    expect(updatedProject.data()).toMatchObject({ status: 'completed', percent: 100 });
    expect(
      updatedWorkItem
        .data()
        ?.tasks.every((task: { completedAt?: string }) => task.completedAt === '2026-10-20'),
    ).toBe(true);
    let agendaAfterDateCorrectionSize = -1;
    await env.withSecurityRulesDisabled(async (context) => {
      agendaAfterDateCorrectionSize = (
        await getDocs(collection(context.firestore(), 'users', 'alice', 'projectAgenda'))
      ).size;
    });
    expect(agendaAfterDateCorrectionSize).toBe(0);
  });

  it('denies owner access to the removed projectAgenda collection', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'alice', 'projectAgenda', 'retired-event'), {
        id: 'retired-event',
        projectId,
        projectTitle: 'Reforma de prueba',
        clientName: 'Cliente de prueba',
        workItemId: 'work-paint',
        workItemName: 'Pintura',
        completedAt: '2026-10-20',
        recordedAt: '2026-10-20T10:00:00.000Z',
      });
    });
    await assertFails(getDoc(doc(alice(), 'users', 'alice', 'projectAgenda', 'retired-event')));
    await assertFails(
      setDoc(doc(alice(), 'users', 'alice', 'projectAgenda', 'new-event'), {
        id: 'new-event',
        projectId,
        projectTitle: 'Reforma de prueba',
        clientName: 'Cliente de prueba',
        workItemId: 'work-paint',
        workItemName: 'Pintura',
        completedAt: '2026-10-20',
        recordedAt: '2026-10-20T10:00:00.000Z',
      }),
    );
  });
});

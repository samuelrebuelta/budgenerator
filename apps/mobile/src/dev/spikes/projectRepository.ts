import { createUserWithEmailAndPassword, getAuth, signOut } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { createProjectRepository } from '@bg/firebase-api/project';
import { generateId, toDateKey } from '@bg/domain';
import {
  addChapter,
  addItem,
  createEmptyDocument,
  type ConstructionDocument,
} from '@bg/domain/construction-document';
import { nativeFirestoreSdk } from '../../platform/firestoreSdk';
import { seedDocument, seedStoredDocument } from '../emulatorAdmin';
import { SpikeRecorder, type SpikeResult } from './report';

/** Accepted budget with two chapters and three items (2 + 1 tasks). */
export function spikeBudgetDocument(): ConstructionDocument {
  let document = createEmptyDocument('budget', {
    clientName: 'Cliente sintético',
    address: 'Obra spike RNFB',
    date: '2026-11-14',
    budgetNumber: '1',
  });
  const paint = addChapter(document, 'Pintura');
  document = addItem(paint.document, paint.chapterId, {
    description: 'Pintura de paredes',
    quantity: 2.5,
    unit: 'm2',
    price: 10.75,
    cost: 4.5,
  }).document;
  document = addItem(document, paint.chapterId, {
    description: 'Imprimación',
    quantity: 8.5,
    unit: 'm2',
    price: 9.79,
    cost: 3,
  }).document;
  const floor = addChapter(document, 'Suelos');
  document = addItem(floor.document, floor.chapterId, {
    description: 'Tarima',
    quantity: 12,
    unit: 'm2',
    price: 31.4,
    cost: 18,
  }).document;
  return document;
}

/** Synthetic account on the Auth emulator; the spike never runs outside development. */
export async function createSyntheticUser(prefix: string) {
  const email = `${prefix}-${Date.now()}@spike.example.test`;
  const credential = await createUserWithEmailAndPassword(
    getAuth(),
    email,
    `Spike-${generateId()}`,
  );
  const uid = credential.user.uid;
  await seedDocument(`users/${uid}`, {
    uid,
    email,
    accountData: { isAdmin: false, plan: 'free' },
    totalBudgetsCreated: 1,
    budgetSlotsReleased: 0,
    createdAt: new Date().toISOString(),
  });
  return { uid, email };
}

export async function seedAcceptedBudget(uid: string, budgetId: string) {
  await seedStoredDocument(`users/${uid}/budgets/${budgetId}`, spikeBudgetDocument(), {
    number: 1,
    acceptedAt: '2026-11-14T09:00:00.000Z',
  });
}

/**
 * Spike D2: the project repository of `@bg/firebase-api` (the same code the web runs on the JS
 * SDK) with React Native Firebase injected, against the Firestore emulator. Each operation
 * exercises a different part of the port: transactions, `deleteField`, `query`/`where in`,
 * `getDocFromServer`/`getDocsFromServer`, `setDoc`, `updateDoc` and `deleteDoc`.
 */
export async function runProjectRepositorySpike(): Promise<SpikeResult> {
  const recorder = new SpikeRecorder('d2-project-repository');
  const repository = createProjectRepository({
    sdk: nativeFirestoreSdk,
    database: getFirestore(),
  });
  try {
    const { uid } = await recorder.step(
      'crear usuario sintético (Auth emulador)',
      () => createSyntheticUser('d2'),
      (user) => user.email,
    );
    const budgetId = `spike-${generateId().slice(0, 8)}`;
    await recorder.step('sembrar presupuesto aceptado + equipo (REST owner)', async () => {
      await seedAcceptedBudget(uid, budgetId);
      await seedDocument(`users/${uid}/teamMembers/m1`, {
        id: 'm1',
        name: 'Ana Obra',
        status: 'active',
        createdAt: '2026-11-14T08:00:00.000Z',
        updatedAt: '2026-11-14T08:00:00.000Z',
      });
    });

    const converted = await recorder.step(
      'convertBudgetToProject (transacción)',
      () => repository.convertBudgetToProject(uid, budgetId),
      (value) => `projectId=${value.projectId} budgetRevision=${value.budgetRevision}`,
    );
    const again = await recorder.step(
      'convertBudgetToProject repetido (idempotente)',
      () => repository.convertBudgetToProject(uid, budgetId),
      (value) => `projectId=${value.projectId}`,
    );
    recorder.check(
      'misma conversión',
      again.projectId === converted.projectId,
      `${again.projectId} = ${converted.projectId}`,
    );

    const projects = await recorder.step(
      'fetchProjects (getDocs)',
      () => repository.fetchProjects(uid),
      (list) => `${list.length} proyecto(s), total ${list[0]?.total ?? '—'} €`,
    );
    recorder.check('un proyecto', projects.length === 1, String(projects.length));

    const detail = await recorder.step(
      'fetchProject (getDoc + chunks + subcolecciones)',
      () => repository.fetchProject(uid, converted.projectId),
      (project) =>
        `${project?.workItems.length ?? 0} capítulos, ${project?.totalConcepts ?? 0} partidas`,
    );
    const workItem = detail?.workItems[0];
    const task = workItem?.tasks[0];
    if (!workItem || !task) throw new Error('El proyecto no tiene partidas.');

    const toggled = await recorder.step(
      'toggleTask (transacción)',
      () => repository.toggleTask(uid, converted.projectId, workItem.id, task.id),
      (mutation) =>
        `${mutation.project.completedConcepts}/${mutation.project.totalConcepts} · ${mutation.project.status} · ${mutation.project.percent} %`,
    );
    recorder.check(
      'partida marcada',
      toggled.project.completedConcepts === 1 && !!toggled.workItem.tasks[0]?.completedAt,
      toggled.workItem.tasks[0]?.completedAt ?? 'sin completedAt',
    );

    const reread = await recorder.step(
      'fetchProject tras marcar',
      () => repository.fetchProject(uid, converted.projectId),
      (project) => `completedConcepts=${project?.completedConcepts}`,
    );
    recorder.check(
      'progreso persistido',
      reread?.completedConcepts === 1 &&
        !!reread.workItems.find((item) => item.id === workItem.id)?.tasks[0]?.completedAt,
      `completedConcepts=${reread?.completedConcepts}`,
    );

    const untoggled = await recorder.step(
      'toggleTask otra vez (deleteField de completedAt)',
      () => repository.toggleTask(uid, converted.projectId, workItem.id, task.id),
      (mutation) => `${mutation.project.completedConcepts}/${mutation.project.totalConcepts}`,
    );
    recorder.check(
      'partida desmarcada',
      untoggled.project.completedConcepts === 0,
      String(untoggled.project.completedConcepts),
    );

    await recorder.step(
      'addSupplement (transacción + deleteField)',
      () =>
        repository.addSupplement(uid, converted.projectId, `sup-${generateId().slice(0, 8)}`, {
          description: 'Ampliación sintética',
          quantity: 2,
          unit: 'u',
          unitPrice: 40,
        }),
      (mutation) => `updatedTotal=${mutation.project.updatedTotal}`,
    );

    await recorder.step(
      'addAssignment (getDocFromServer + getDocsFromServer + transacción)',
      () => repository.addAssignment(uid, converted.projectId, 'member', 'm1'),
      (assignment) => assignment.id,
    );

    const today = toDateKey(new Date());
    await recorder.step(
      'saveDailyAssignments (setDoc)',
      () =>
        repository.saveDailyAssignments(uid, converted.projectId, today, [
          {
            id: 'member_m1',
            resourceType: 'member',
            resourceId: 'm1',
            label: 'Ana Obra',
            members: [{ id: 'm1', name: 'Ana Obra' }],
            assignedAt: new Date().toISOString(),
          },
        ]),
      (override) => override.date,
    );
    const schedule = await recorder.step(
      "fetchTeamSchedule (query + where 'in')",
      () => repository.fetchTeamSchedule(uid, [converted.projectId], [today]),
      (data) =>
        `${data.assignmentsByProjectId[converted.projectId]?.length ?? 0} asignación(es), ${
          Object.keys(data.overridesByProjectDate).length
        } día(s)`,
    );
    recorder.check(
      'plan del día leído',
      Object.keys(schedule.overridesByProjectDate).length === 1,
      Object.keys(schedule.overridesByProjectDate).join(','),
    );
    await recorder.step('removeDailyAssignmentOverride (deleteDoc)', () =>
      repository.removeDailyAssignmentOverride(uid, converted.projectId, today),
    );
    await recorder.step('setEstimatedEndDate (updateDoc)', () =>
      repository.setEstimatedEndDate(uid, converted.projectId, '2026-12-31'),
    );
    await recorder.step(
      'updateProjectMetadata (transacción sobre proyecto y presupuesto)',
      () =>
        repository.updateProjectMetadata(uid, converted.projectId, 'Obra renombrada', 'Cliente'),
      (value) => `budgetRevision=${value.budgetRevision}`,
    );
  } catch {
    // The failing step is already recorded; the report shows where it stopped.
  } finally {
    await signOut(getAuth()).catch(() => undefined);
  }
  return recorder.finish();
}

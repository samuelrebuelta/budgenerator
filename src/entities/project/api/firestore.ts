import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import { money, taskAmount } from '@/shared/lib/budgetMath';
import { mapBudgetFromFirestore } from '@/entities/budget/model/serialization';
import type { FirestoreBudget } from '@/entities/budget/model/serialization';
import { prepareProjectSnapshot } from '../model/conversion';
import { getProjectLocalDateKey, normalizeProjectCompletionDate } from '../model/history';
import type {
  NewProjectSupplement,
  Project,
  ProjectDetail,
  ProjectProgress,
  ProjectProgressMutation,
  ProjectSupplement,
  ProjectSupplementMutation,
  ProjectSupplementVoid,
  ProjectSupplementVoidMutation,
  ProjectTask,
  ProjectWorkItem,
} from '../model/types';
import { buildProjectSupplement, createSupplementWorkItem } from '../model/supplements';

function amountForCompletedTasks(tasks: ProjectTask[]) {
  return money(tasks.reduce((total, task) => total + (task.completedAt ? taskAmount(task) : 0), 0));
}

function progressAfterWorkItemChange(
  project: Project,
  before: ProjectWorkItem,
  after: ProjectWorkItem,
  completedAt: string,
): ProjectProgress & { completedAt?: string } {
  const completedConcepts = Math.max(
    0,
    Math.min(
      project.totalConcepts,
      project.completedConcepts +
        after.tasks.filter((task) => task.completedAt).length -
        before.tasks.filter((task) => task.completedAt).length,
    ),
  );
  const completedAmount = money(
    project.completedAmount +
      amountForCompletedTasks(after.tasks) -
      amountForCompletedTasks(before.tasks),
  );
  const status =
    completedConcepts === 0
      ? 'pending'
      : completedConcepts === project.totalConcepts
        ? 'completed'
        : 'in_progress';
  const roundedPercent =
    project.totalConcepts === 0
      ? 0
      : Math.round(
          project.mode === 'amount' && project.totalAmount > 0
            ? (completedAmount / project.totalAmount) * 100
            : (completedConcepts / project.totalConcepts) * 100,
        );
  const percent = status === 'completed' ? 100 : Math.min(99, Math.max(0, roundedPercent));
  return {
    mode: project.mode,
    totalConcepts: project.totalConcepts,
    completedConcepts,
    totalAmount: project.totalAmount,
    completedAmount,
    percent: Math.max(0, Math.min(100, percent)),
    status,
    ...(status === 'completed' ? { completedAt: project.completedAt ?? completedAt } : {}),
  };
}

function projectsCollection(database: Firestore, uid: string) {
  return collection(database, 'users', uid, 'projects');
}

class ProjectWorkItemsChangedError extends Error {}

function percentage(
  project: Project,
  totalConcepts: number,
  completedConcepts: number,
  totalAmount: number,
  completedAmount: number,
) {
  const roundedPercent =
    totalConcepts === 0
      ? 0
      : Math.round(
          project.mode === 'amount' && totalAmount > 0
            ? (completedAmount / totalAmount) * 100
            : (completedConcepts / totalConcepts) * 100,
        );
  const completed = totalConcepts > 0 && completedConcepts === totalConcepts;
  return Math.max(0, Math.min(completed ? 100 : 99, roundedPercent));
}

export function createProjectFirestoreApi(database: Firestore) {
  async function convertBudgetToProject(uid: string, budgetId: string): Promise<string> {
    const budgetRef = doc(database, 'users', uid, 'budgets', budgetId);
    const projects = projectsCollection(database, uid);
    const candidateProjectRef = doc(projects, budgetId);
    const convertedAt = new Date().toISOString();

    try {
      return await runTransaction(database, async (transaction) => {
        const budgetSnapshot = await transaction.get(budgetRef);
        if (!budgetSnapshot.exists()) throw new Error('No se ha encontrado el presupuesto.');
        const budget = mapBudgetFromFirestore(budgetSnapshot.data() as FirestoreBudget);

        if (budget.projectId) {
          const existingProject = await transaction.get(doc(projects, budget.projectId));
          if (!existingProject.exists())
            throw new Error('No se ha encontrado el proyecto vinculado a este presupuesto.');
          return budget.projectId;
        }

        const snapshot = prepareProjectSnapshot(budget, candidateProjectRef.id, convertedAt);
        const collision = await transaction.get(candidateProjectRef);
        if (collision.exists())
          throw new Error('No se ha podido crear el proyecto. Vuelve a intentarlo.');

        transaction.set(candidateProjectRef, snapshot.project);
        for (const workItem of snapshot.workItems)
          transaction.set(doc(candidateProjectRef, 'workItems', workItem.id), workItem);
        transaction.update(budgetRef, { projectId: candidateProjectRef.id });

        return candidateProjectRef.id;
      });
    } catch (error) {
      // Two devices can read the same unconverted source before either commit.
      // Firestore Rules may reject the stale second write before the transaction
      // reports a retryable conflict, so confirm the atomic winner's postcondition.
      const [currentBudget, currentProject] = await Promise.all([
        getDoc(budgetRef),
        getDoc(candidateProjectRef),
      ]);
      if (
        currentBudget.data()?.projectId === candidateProjectRef.id &&
        currentProject.exists() &&
        currentProject.data().sourceBudgetId === budgetId
      ) {
        return candidateProjectRef.id;
      }
      throw error;
    }
  }

  async function fetchProjects(uid: string): Promise<Project[]> {
    const snapshot = await getDocs(projectsCollection(database, uid));
    return snapshot.docs
      .map((project) => ({ ...project.data(), id: project.id }) as Project)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function fetchProject(uid: string, projectId: string): Promise<ProjectDetail | null> {
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const snapshot = await getDoc(projectRef);
    if (!snapshot.exists()) return null;
    const [workItemsSnapshot, supplementsSnapshot, voidsSnapshot] = await Promise.all([
      getDocs(collection(projectRef, 'workItems')),
      getDocs(collection(projectRef, 'supplements')),
      getDocs(collection(projectRef, 'supplementVoids')),
    ]);
    const workItems = workItemsSnapshot.docs
      .map((workItem) => ({ ...workItem.data(), id: workItem.id }) as ProjectWorkItem)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const supplements = supplementsSnapshot.docs
      .map((supplement) => ({ ...supplement.data(), id: supplement.id }) as ProjectSupplement)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const supplementVoids = voidsSnapshot.docs.map(
      (supplementVoid) => supplementVoid.data() as ProjectSupplementVoid,
    );
    return {
      ...snapshot.data(),
      id: snapshot.id,
      workItems,
      supplements,
      supplementVoids,
    } as ProjectDetail;
  }

  async function mutateWorkItem(
    uid: string,
    projectId: string,
    workItemId: string,
    updateTasks: (tasks: ProjectTask[], completedAt: string) => ProjectTask[],
  ): Promise<ProjectProgressMutation> {
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const workItemRef = doc(collection(projectRef, 'workItems'), workItemId);
    const changedAt = new Date().toISOString();

    return runTransaction(database, async (transaction) => {
      const [projectSnapshot, workItemSnapshot] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(workItemRef),
      ]);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      if (!workItemSnapshot.exists()) throw new Error('No se ha encontrado la partida.');
      const project = { ...projectSnapshot.data(), id: projectSnapshot.id } as Project;
      const workItem = { ...workItemSnapshot.data(), id: workItemSnapshot.id } as ProjectWorkItem;
      if (workItem.voidedAt) throw new Error('Esta ampliación está anulada.');
      const tasks = updateTasks(workItem.tasks, changedAt);
      const nextWorkItem = { ...workItem, tasks };
      const nextProgress = progressAfterWorkItemChange(project, workItem, nextWorkItem, changedAt);
      const { completedAt, ...progress } = nextProgress;
      const projectUpdate = {
        ...progress,
        completedAt: completedAt ?? deleteField(),
      };
      const nextProject = { ...project, ...progress } as Project;
      if (completedAt) nextProject.completedAt = completedAt;
      else Reflect.deleteProperty(nextProject, 'completedAt');

      if (JSON.stringify(tasks) !== JSON.stringify(workItem.tasks)) {
        transaction.update(workItemRef, { tasks });
        transaction.update(projectRef, projectUpdate);
      }

      return {
        project: nextProject,
        workItem: nextWorkItem,
      };
    });
  }

  async function toggleTask(
    uid: string,
    projectId: string,
    workItemId: string,
    taskId: string,
  ): Promise<ProjectProgressMutation> {
    return mutateWorkItem(uid, projectId, workItemId, (tasks, changedAt) => {
      if (!tasks.some((task) => task.id === taskId))
        throw new Error('No se ha encontrado el concepto.');
      return tasks.map((task) => {
        if (task.id !== taskId) return task;
        const updated = { ...task };
        if (updated.completedAt) Reflect.deleteProperty(updated, 'completedAt');
        else updated.completedAt = changedAt;
        return updated;
      });
    });
  }

  async function completeWorkItem(
    uid: string,
    projectId: string,
    workItemId: string,
  ): Promise<ProjectProgressMutation> {
    return mutateWorkItem(uid, projectId, workItemId, (tasks, changedAt) => {
      if (!tasks.length) throw new Error('Esta partida no tiene conceptos que completar.');
      return tasks.map((task) => (task.completedAt ? task : { ...task, completedAt: changedAt }));
    });
  }

  async function mutateCompletionDate(
    uid: string,
    projectId: string,
    workItemId: string,
    completedAt: string,
    updateTasks: (tasks: ProjectTask[], normalizedDate: string) => ProjectTask[],
  ): Promise<ProjectProgressMutation> {
    const normalizedDate = normalizeProjectCompletionDate(completedAt);
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const workItemsCollection = collection(projectRef, 'workItems');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const workItemsSnapshot = await getDocs(workItemsCollection);
      const workItemRefs = workItemsSnapshot.docs.map((snapshot) => snapshot.ref);
      try {
        return await runTransaction(database, async (transaction) => {
          const [projectSnapshot, ...workItemSnapshots] = await Promise.all([
            transaction.get(projectRef),
            ...workItemRefs.map((ref) => transaction.get(ref)),
          ]);
          if (!projectSnapshot?.exists()) throw new Error('No se ha encontrado el proyecto.');
          const project = { ...projectSnapshot.data(), id: projectSnapshot.id } as Project;
          const workItems = workItemSnapshots.map((snapshot) =>
            snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as ProjectWorkItem) : null,
          );
          const activeWorkItems = workItems.filter(
            (workItem): workItem is ProjectWorkItem => !!workItem && !workItem.voidedAt,
          );
          if (
            workItems.some((workItem) => !workItem) ||
            activeWorkItems.length !== project.workItemCount
          )
            throw new ProjectWorkItemsChangedError('El proyecto ha cambiado.');

          const workItemIndex = workItems.findIndex((workItem) => workItem?.id === workItemId);
          const before = workItems[workItemIndex];
          if (!before) throw new Error('No se ha encontrado la partida.');
          if (before.voidedAt) throw new Error('Esta ampliación está anulada.');
          const after = { ...before, tasks: updateTasks(before.tasks, normalizedDate) };
          const nextWorkItems = [...workItems];
          nextWorkItems[workItemIndex] = after;
          const activeTasks = nextWorkItems
            .filter((workItem): workItem is ProjectWorkItem => !!workItem && !workItem.voidedAt)
            .flatMap((workItem) => workItem.tasks);
          if (activeTasks.length !== project.totalConcepts)
            throw new Error(
              'El historial no coincide con el resumen del proyecto. Recarga e inténtalo de nuevo.',
            );

          const allComplete =
            project.status === 'completed' &&
            activeTasks.length > 0 &&
            activeTasks.every((task) => !!task.completedAt);
          const nextCompletedAt = allComplete
            ? activeTasks
                .map((task) => getProjectLocalDateKey(task.completedAt!))
                .sort((a, b) => b.localeCompare(a))[0]
            : undefined;
          const nextProject = { ...project };
          if (nextCompletedAt) nextProject.completedAt = nextCompletedAt;
          else Reflect.deleteProperty(nextProject, 'completedAt');

          const tasksChanged = JSON.stringify(after.tasks) !== JSON.stringify(before.tasks);
          if (tasksChanged)
            transaction.update(workItemRefs[workItemIndex]!, { tasks: after.tasks });
          if (project.completedAt !== nextCompletedAt) {
            transaction.update(projectRef, { completedAt: nextCompletedAt ?? deleteField() });
          }
          return { project: nextProject, workItem: after };
        });
      } catch (error) {
        if (!(error instanceof ProjectWorkItemsChangedError) || attempt === 2) throw error;
      }
    }

    throw new Error('El proyecto ha cambiado. Recarga e inténtalo de nuevo.');
  }

  async function setTaskCompletionDate(
    uid: string,
    projectId: string,
    workItemId: string,
    taskId: string,
    completedAt: string,
  ): Promise<ProjectProgressMutation> {
    return mutateCompletionDate(
      uid,
      projectId,
      workItemId,
      completedAt,
      (tasks, normalizedDate) => {
        if (!tasks.some((task) => task.id === taskId))
          throw new Error('No se ha encontrado el concepto.');
        if (!tasks.some((task) => task.id === taskId && task.completedAt))
          throw new Error('Completa el concepto antes de cambiar su fecha.');
        return tasks.map((task) =>
          task.id === taskId ? { ...task, completedAt: normalizedDate } : task,
        );
      },
    );
  }

  async function setWorkItemCompletionDate(
    uid: string,
    projectId: string,
    workItemId: string,
    completedAt: string,
  ): Promise<ProjectProgressMutation> {
    return mutateCompletionDate(
      uid,
      projectId,
      workItemId,
      completedAt,
      (tasks, normalizedDate) => {
        if (!tasks.length) throw new Error('Esta partida no tiene conceptos que actualizar.');
        if (tasks.some((task) => !task.completedAt))
          throw new Error('Completa todos los conceptos antes de cambiar la fecha de la partida.');
        return tasks.map((task) => ({ ...task, completedAt: normalizedDate }));
      },
    );
  }

  async function addSupplement(
    uid: string,
    projectId: string,
    supplementId: string,
    input: NewProjectSupplement,
  ): Promise<ProjectSupplementMutation> {
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const supplementRef = doc(collection(projectRef, 'supplements'), supplementId);
    const voidRef = doc(collection(projectRef, 'supplementVoids'), supplementId);
    const createdAt = new Date().toISOString();

    return runTransaction(database, async (transaction) => {
      const projectSnapshot = await transaction.get(projectRef);
      const [supplementSnapshot, voidSnapshot] = await Promise.all([
        transaction.get(supplementRef),
        transaction.get(voidRef),
      ]);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      const project = { ...projectSnapshot.data(), id: projectSnapshot.id } as Project;
      const workItemId = `supplement_${supplementId}`;
      const workItemRef = doc(collection(projectRef, 'workItems'), workItemId);
      const workItemSnapshot = await transaction.get(workItemRef);

      if (supplementSnapshot.exists()) {
        if (!workItemSnapshot.exists())
          throw new Error('La ampliación guardada tiene registros incompletos.');
        return {
          project,
          supplement: {
            ...supplementSnapshot.data(),
            id: supplementSnapshot.id,
          } as ProjectSupplement,
          workItem: { ...workItemSnapshot.data(), id: workItemSnapshot.id } as ProjectWorkItem,
        };
      }
      if (voidSnapshot.exists() || workItemSnapshot.exists())
        throw new Error('El identificador de la ampliación ya está ocupado.');

      const supplement = buildProjectSupplement(project, supplementId, input, createdAt);
      const workItem = createSupplementWorkItem(supplement, project.workItemCount);
      const supplementsSubtotal = money((project.supplementsSubtotal ?? 0) + supplement.subtotal);
      const supplementsIva = money((project.supplementsIva ?? 0) + supplement.iva);
      const updatedTotal = money((project.updatedTotal ?? project.total) + supplement.total);
      const totalConcepts = project.totalConcepts + workItem.tasks.length;
      const totalAmount = money(project.totalAmount + supplement.subtotal);
      const completedConcepts = project.completedConcepts;
      const completedAmount = project.completedAmount;
      const status: Project['status'] =
        completedConcepts === 0
          ? 'pending'
          : completedConcepts === totalConcepts
            ? 'completed'
            : 'in_progress';
      const percent = percentage(
        project,
        totalConcepts,
        completedConcepts,
        totalAmount,
        completedAmount,
      );
      const projectUpdate = {
        lastSupplementId: supplementId,
        lastSupplementAction: 'added' as const,
        supplementsSubtotal,
        supplementsIva,
        updatedTotal,
        workItemCount: project.workItemCount + 1,
        totalConcepts,
        completedConcepts,
        totalAmount,
        completedAmount,
        percent,
        status,
      };
      const nextProject: Project = { ...project, ...projectUpdate };
      Reflect.deleteProperty(nextProject, 'completedAt');
      const update = { ...projectUpdate, completedAt: deleteField() };

      transaction.set(supplementRef, supplement);
      transaction.set(workItemRef, workItem);
      transaction.update(projectRef, update);

      return { project: nextProject, supplement, workItem };
    });
  }

  async function voidSupplement(
    uid: string,
    projectId: string,
    supplementId: string,
    reason: string,
  ): Promise<ProjectSupplementVoidMutation> {
    const normalizedReason = reason.trim();
    if (!normalizedReason || normalizedReason.length > 500)
      throw new Error('Indica un motivo de anulación de hasta 500 caracteres.');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(supplementId))
      throw new Error('El identificador de la ampliación no es válido.');

    const projectRef = doc(projectsCollection(database, uid), projectId);
    const supplementRef = doc(collection(projectRef, 'supplements'), supplementId);
    const voidRef = doc(collection(projectRef, 'supplementVoids'), supplementId);
    const workItemRef = doc(collection(projectRef, 'workItems'), `supplement_${supplementId}`);
    const voidedAt = new Date().toISOString();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const workItemsSnapshot = await getDocs(collection(projectRef, 'workItems'));
      const workItemRefs = workItemsSnapshot.docs.map((snapshot) => snapshot.ref);
      try {
        return await runTransaction(database, async (transaction) => {
          const [projectSnapshot, supplementSnapshot, voidSnapshot, ...workItemSnapshots] =
            await Promise.all([
              transaction.get(projectRef),
              transaction.get(supplementRef),
              transaction.get(voidRef),
              ...workItemRefs.map((ref) => transaction.get(ref)),
            ]);
          if (!projectSnapshot?.exists()) throw new Error('No se ha encontrado el proyecto.');
          if (!supplementSnapshot?.exists()) throw new Error('No se ha encontrado la ampliación.');
          if (!voidSnapshot) throw new Error('No se ha podido leer el historial de ampliaciones.');
          const project = { ...projectSnapshot.data(), id: projectSnapshot.id } as Project;
          const supplement = {
            ...supplementSnapshot.data(),
            id: supplementSnapshot.id,
          } as ProjectSupplement;
          const workItems = workItemSnapshots.map((snapshot) =>
            snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as ProjectWorkItem) : null,
          );
          const workItemIndex = workItemRefs.findIndex((ref) => ref.id === workItemRef.id);
          const workItem = workItems[workItemIndex];
          if (!workItem) throw new Error('No se ha encontrado el trabajo añadido.');

          if (voidSnapshot.exists()) {
            const existingVoid = voidSnapshot.data() as ProjectSupplementVoid;
            if (existingVoid.reason !== normalizedReason)
              throw new Error('La ampliación ya se anuló con otro motivo.');
            if (!workItem.voidedAt)
              throw new Error('La anulación guardada tiene registros incompletos.');
            return { project, supplementVoid: existingVoid, workItem };
          }
          if (workItem.voidedAt) throw new Error('La ampliación ya está marcada como anulada.');
          if (workItem.supplementId !== supplementId)
            throw new Error('La ampliación no coincide con el trabajo añadido.');
          const activeWorkItems = workItems.filter(
            (item): item is ProjectWorkItem => !!item && !item.voidedAt,
          );
          if (workItems.some((item) => !item) || activeWorkItems.length !== project.workItemCount)
            throw new ProjectWorkItemsChangedError('El proyecto ha cambiado.');

          const supplementVoid: ProjectSupplementVoid = {
            supplementId,
            reason: normalizedReason,
            voidedAt,
          };
          const completedTasks = workItem.tasks.filter((task) => task.completedAt);
          const completedConcepts = Math.max(0, project.completedConcepts - completedTasks.length);
          const totalConcepts = Math.max(0, project.totalConcepts - workItem.tasks.length);
          const completedAmount = money(
            Math.max(0, project.completedAmount - amountForCompletedTasks(workItem.tasks)),
          );
          const totalAmount = money(Math.max(0, project.totalAmount - supplement.subtotal));
          const status: Project['status'] =
            completedConcepts === 0 || totalConcepts === 0
              ? 'pending'
              : completedConcepts === totalConcepts
                ? 'completed'
                : 'in_progress';
          const supplementsSubtotal = money(
            Math.max(0, (project.supplementsSubtotal ?? 0) - supplement.subtotal),
          );
          const supplementsIva = money(Math.max(0, (project.supplementsIva ?? 0) - supplement.iva));
          const projectUpdate = {
            lastSupplementId: supplementId,
            lastSupplementAction: 'voided' as const,
            supplementsSubtotal,
            supplementsIva,
            updatedTotal: money(
              Math.max(0, (project.updatedTotal ?? project.total) - supplement.total),
            ),
            workItemCount: Math.max(0, project.workItemCount - 1),
            totalConcepts,
            completedConcepts,
            totalAmount,
            completedAmount,
            percent: percentage(
              project,
              totalConcepts,
              completedConcepts,
              totalAmount,
              completedAmount,
            ),
            status,
          };
          const remainingWorkItems = activeWorkItems.filter((item) => item.id !== workItem.id);
          const remainingTasks = remainingWorkItems.flatMap((item) => item.tasks);
          const completionDates =
            status === 'completed' && remainingTasks.length > 0
              ? remainingTasks.map((task) => getProjectLocalDateKey(task.completedAt!))
              : [];
          const completedAt = completionDates.sort((a, b) => b.localeCompare(a))[0];
          const update = { ...projectUpdate, completedAt: completedAt ?? deleteField() };
          const nextProject: Project = { ...project, ...projectUpdate };
          if (completedAt) nextProject.completedAt = completedAt;
          else Reflect.deleteProperty(nextProject, 'completedAt');

          transaction.set(voidRef, supplementVoid);
          transaction.update(workItemRef, { voidedAt });
          transaction.update(projectRef, update);

          return {
            project: nextProject,
            supplementVoid,
            workItem: { ...workItem, voidedAt },
          };
        });
      } catch (error) {
        if (!(error instanceof ProjectWorkItemsChangedError) || attempt === 2) throw error;
      }
    }

    throw new Error('El proyecto ha cambiado. Recarga e inténtalo de nuevo.');
  }

  return {
    convertBudgetToProject,
    fetchProjects,
    fetchProject,
    toggleTask,
    completeWorkItem,
    setTaskCompletionDate,
    setWorkItemCompletionDate,
    addSupplement,
    voidSupplement,
  };
}

export type ProjectFirestoreApi = ReturnType<typeof createProjectFirestoreApi>;

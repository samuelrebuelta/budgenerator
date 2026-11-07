import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { money, taskAmount } from '@/shared/lib/budgetMath';
import { mapBudgetFromFirestore } from '@/entities/budget/model/serialization';
import type { FirestoreBudget } from '@/entities/budget/model/serialization';
import type { CrewColor } from '@/shared/types';
import { prepareProjectSnapshot } from '../model/conversion';
import { getProjectLocalDateKey, normalizeProjectCompletionDate } from '../model/history';
import { buildProjectAssignment, findCrewAssignmentForMember } from '../model/assignments';
import type {
  NewProjectSupplement,
  ProjectAssignment,
  ProjectDailyAssignmentOverride,
  Project,
  ProjectDetail,
  ProjectProgress,
  ProjectProgressMutation,
  ProjectSupplement,
  ProjectSupplementMutation,
  ProjectSupplementVoid,
  ProjectSupplementVoidMutation,
  ProjectTeamScheduleData,
  ProjectTask,
  ProjectWorkItem,
} from '../model/types';
import { buildProjectSupplement, createSupplementWorkItem } from '../model/supplements';
import { normalizeEstimatedEndDate } from '../model/estimatedEndDate';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

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
  const maxDailyAssignmentBytes = 900_000;

  function assertDailyScheduleDate(dateKey: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))
      throw new Error('La fecha del plan semanal no es válida.');
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(0);
    date.setFullYear(year!, month! - 1, day!);
    date.setHours(0, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month! - 1 || date.getDate() !== day)
      throw new Error('La fecha del plan semanal no es válida.');
  }

  async function fetchTeamSchedule(
    uid: string,
    projectIds: string[],
    dateKeys: string[],
  ): Promise<ProjectTeamScheduleData> {
    const uniqueProjectIds = [...new Set(projectIds)];
    const uniqueDateKeys = [...new Set(dateKeys)];
    if (uniqueDateKeys.length > 30) throw new Error('El rango del plan semanal no es válido.');
    uniqueDateKeys.forEach(assertDailyScheduleDate);

    const projectData = await Promise.all(
      uniqueProjectIds.map(async (projectId) => {
        const projectRef = doc(projectsCollection(database, uid), projectId);
        const [assignmentsSnapshot, overridesSnapshot] = await Promise.all([
          getDocs(collection(projectRef, 'assignments')),
          uniqueDateKeys.length
            ? getDocs(
                query(
                  collection(projectRef, 'dailyAssignments'),
                  where('date', 'in', uniqueDateKeys),
                ),
              )
            : Promise.resolve(null),
        ]);
        const assignments = assignmentsSnapshot.docs.map(
          (snapshot) => ({ ...snapshot.data(), id: snapshot.id }) as ProjectAssignment,
        );
        const overrides = (overridesSnapshot?.docs ?? []).map(
          (snapshot) =>
            ({ ...snapshot.data(), date: snapshot.id }) as ProjectDailyAssignmentOverride,
        );
        return { projectId, assignments, overrides };
      }),
    );

    return {
      assignmentsByProjectId: Object.fromEntries(
        projectData.map(({ projectId, assignments }) => [projectId, assignments]),
      ),
      overridesByProjectDate: Object.fromEntries(
        projectData.flatMap(({ projectId, overrides }) =>
          overrides.map((override) => [`${projectId}:${override.date}`, override]),
        ),
      ),
    };
  }

  async function saveDailyAssignments(
    uid: string,
    projectId: string,
    dateKey: string,
    assignments: ProjectAssignment[],
  ): Promise<ProjectDailyAssignmentOverride> {
    assertDailyScheduleDate(dateKey);
    if (!projectId || projectId.includes('/'))
      throw new Error('El proyecto del plan semanal no es válido.');
    if (!Array.isArray(assignments) || assignments.length > 500)
      throw new Error('El equipo de este día supera el límite permitido.');
    const resourceIds = assignments.map(
      (assignment) => `${assignment.resourceType}:${assignment.resourceId}`,
    );
    if (new Set(resourceIds).size !== resourceIds.length)
      throw new Error('No se puede asignar dos veces el mismo recurso a este proyecto.');
    const override: ProjectDailyAssignmentOverride = {
      date: dateKey,
      projectId,
      assignments,
      updatedAt: new Date().toISOString(),
    };
    if (new TextEncoder().encode(JSON.stringify(override)).length >= maxDailyAssignmentBytes)
      throw new Error('El plan de este día supera el límite permitido.');

    const projectRef = doc(projectsCollection(database, uid), projectId);
    await setDoc(doc(collection(projectRef, 'dailyAssignments'), dateKey), override);
    return override;
  }

  async function removeDailyAssignmentOverride(uid: string, projectId: string, dateKey: string) {
    assertDailyScheduleDate(dateKey);
    const projectRef = doc(projectsCollection(database, uid), projectId);
    await deleteDoc(doc(collection(projectRef, 'dailyAssignments'), dateKey));
  }

  async function setEstimatedEndDate(uid: string, projectId: string, value: string) {
    if (!projectId || projectId.includes('/')) throw new Error('El proyecto no es válido.');
    const estimatedEndDate = normalizeEstimatedEndDate(value);
    await updateDoc(doc(projectsCollection(database, uid), projectId), { estimatedEndDate });
  }

  async function updateProjectMetadata(
    uid: string,
    projectId: string,
    title: string,
    clientName: string,
  ) {
    if (!projectId || projectId.includes('/')) throw new Error('El proyecto no es válido.');
    const normalizedTitle = title.trim();
    const normalizedClientName = clientName.trim();
    if (!normalizedTitle || normalizedTitle.length > 120)
      throw new Error('El nombre del proyecto debe tener entre 1 y 120 caracteres.');
    if (normalizedClientName.length > 120)
      throw new Error('El nombre del cliente no puede superar los 120 caracteres.');

    const projectRef = doc(projectsCollection(database, uid), projectId);
    return runTransaction(database, async (transaction) => {
      const projectSnapshot = await transaction.get(projectRef);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      const project = { ...projectSnapshot.data(), id: projectSnapshot.id } as Project;
      const budgetId = project.sourceBudgetId;
      if (!budgetId || budgetId.includes('/'))
        throw new Error('El proyecto no tiene un presupuesto de origen válido.');

      const budgetRef = doc(database, 'users', uid, 'budgets', budgetId);
      const budgetSnapshot = await transaction.get(budgetRef);
      if (!budgetSnapshot.exists())
        throw new Error('No se ha encontrado el presupuesto de origen.');
      const budget = mapBudgetFromFirestore(budgetSnapshot.data() as FirestoreBudget);
      if (budget.projectId !== projectId)
        throw new Error('El presupuesto de origen no está vinculado a este proyecto.');

      const metadata = {
        title: normalizedTitle,
        address: normalizedTitle,
        clientName: normalizedClientName,
      };
      transaction.update(projectRef, metadata);
      transaction.update(budgetRef, {
        'info.address': normalizedTitle,
        'info.clientName': normalizedClientName,
      });
      return metadata;
    });
  }

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
    const [workItemsSnapshot, supplementsSnapshot, voidsSnapshot, assignmentsSnapshot] =
      await Promise.all([
        getDocs(collection(projectRef, 'workItems')),
        getDocs(collection(projectRef, 'supplements')),
        getDocs(collection(projectRef, 'supplementVoids')),
        getDocs(collection(projectRef, 'assignments')),
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
    const assignments = assignmentsSnapshot.docs
      .map((assignment) => ({ ...assignment.data(), id: assignment.id }) as ProjectAssignment)
      .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
    return {
      ...snapshot.data(),
      id: snapshot.id,
      workItems,
      assignments,
      supplements,
      supplementVoids,
    } as ProjectDetail;
  }

  async function addAssignment(
    uid: string,
    projectId: string,
    resourceType: ProjectAssignment['resourceType'],
    resourceId: string,
  ): Promise<ProjectAssignment> {
    if (!resourceId || resourceId.length > 128 || resourceId.includes('/'))
      throw new Error('El recurso no tiene un ID válido.');
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const assignmentId = `${resourceType}_${resourceId}`;
    const assignmentRef = doc(collection(projectRef, 'assignments'), assignmentId);
    const assignedAt = new Date().toISOString();

    if (resourceType === 'member') {
      const assignmentsSnapshot = await getDocs(collection(projectRef, 'assignments'));
      const projectAssignments = assignmentsSnapshot.docs.map(
        (snapshot) => ({ ...snapshot.data(), id: snapshot.id }) as ProjectAssignment,
      );
      if (findCrewAssignmentForMember(resourceId, projectAssignments))
        throw new Error('La persona ya está incluida en una cuadrilla asignada a este proyecto.');
    }

    return runTransaction(database, async (transaction) => {
      const [projectSnapshot, existingAssignment] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(assignmentRef),
      ]);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      if (existingAssignment.exists())
        return { ...existingAssignment.data(), id: existingAssignment.id } as ProjectAssignment;

      let assignment: ProjectAssignment;
      if (resourceType === 'member') {
        const memberRef = doc(database, 'users', uid, 'teamMembers', resourceId);
        const memberSnapshot = await transaction.get(memberRef);
        if (!memberSnapshot.exists()) throw new Error('No se ha encontrado a la persona.');
        const member = { ...memberSnapshot.data(), id: memberSnapshot.id } as {
          id: string;
          name: string;
          status: 'active' | 'inactive';
        };
        assignment = buildProjectAssignment({ resourceType, resource: member }, assignedAt);
      } else {
        const crewRef = doc(database, 'users', uid, 'crews', resourceId);
        const crewSnapshot = await transaction.get(crewRef);
        if (!crewSnapshot.exists()) throw new Error('No se ha encontrado la cuadrilla.');
        const crew = { ...crewSnapshot.data(), id: crewSnapshot.id } as {
          id: string;
          label: string;
          color: CrewColor;
          memberIds: string[];
          status: 'active' | 'inactive';
        };
        const memberIds = [...new Set(crew.memberIds)];
        if (memberIds.some((id) => !id || id.length > 128 || id.includes('/')))
          throw new Error('La cuadrilla contiene una referencia de persona no válida.');
        const memberSnapshots = await Promise.all(
          memberIds.map((id) => transaction.get(doc(database, 'users', uid, 'teamMembers', id))),
        );
        const members = memberSnapshots.map((snapshot, index) => {
          if (!snapshot.exists())
            throw new Error('No se ha encontrado a una persona de la cuadrilla.');
          return { ...snapshot.data(), id: memberIds[index] } as {
            id: string;
            name: string;
            status: 'active' | 'inactive';
          };
        });
        assignment = buildProjectAssignment({ resourceType, resource: crew, members }, assignedAt);
      }

      transaction.set(assignmentRef, assignment);
      return assignment;
    });
  }

  async function removeAssignment(
    uid: string,
    projectId: string,
    assignmentId: string,
  ): Promise<void> {
    if (!assignmentId || assignmentId.length > 134 || assignmentId.includes('/'))
      throw new Error('La asignación no tiene un ID válido.');
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const assignmentRef = doc(collection(projectRef, 'assignments'), assignmentId);
    await runTransaction(database, async (transaction) => {
      const [projectSnapshot, assignmentSnapshot] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(assignmentRef),
      ]);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      if (assignmentSnapshot.exists()) transaction.delete(assignmentRef);
    });
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
      if (!workItemSnapshot.exists()) throw new Error('No se ha encontrado el capítulo.');
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
        throw new Error('No se ha encontrado la partida.');
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
      if (!tasks.length) throw new Error('Este capítulo no tiene partidas que completar.');
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
          if (!before) throw new Error('No se ha encontrado el capítulo.');
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
          throw new Error('No se ha encontrado la partida.');
        if (!tasks.some((task) => task.id === taskId && task.completedAt))
          throw new Error('Completa la partida antes de cambiar su fecha.');
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
        if (!tasks.length) throw new Error('Este capítulo no tiene partidas que actualizar.');
        if (tasks.some((task) => !task.completedAt))
          throw new Error('Completa todas las partidas antes de cambiar la fecha del capítulo.');
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
    convertBudgetToProject: guardNetworkMutation(convertBudgetToProject),
    fetchProjects,
    fetchProject,
    fetchTeamSchedule,
    saveDailyAssignments: guardNetworkMutation(saveDailyAssignments),
    removeDailyAssignmentOverride: guardNetworkMutation(removeDailyAssignmentOverride),
    setEstimatedEndDate: guardNetworkMutation(setEstimatedEndDate),
    updateProjectMetadata: guardNetworkMutation(updateProjectMetadata),
    addAssignment: guardNetworkMutation(addAssignment),
    removeAssignment: guardNetworkMutation(removeAssignment),
    toggleTask: guardNetworkMutation(toggleTask),
    completeWorkItem: guardNetworkMutation(completeWorkItem),
    setTaskCompletionDate: guardNetworkMutation(setTaskCompletionDate),
    setWorkItemCompletionDate: guardNetworkMutation(setWorkItemCompletionDate),
    addSupplement: guardNetworkMutation(addSupplement),
    voidSupplement: guardNetworkMutation(voidSupplement),
  };
}

export type ProjectFirestoreApi = ReturnType<typeof createProjectFirestoreApi>;

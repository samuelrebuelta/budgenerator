import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { money, taskAmount } from '@/shared/lib/budgetMath';
import { readStoredDocument } from '@/entities/construction-document/api/storage';
import type { ConstructionDocument } from '@/entities/construction-document/model';
import type { BudgetRoot } from '@/entities/budget/api/firestore';
import { budgetView } from '@/entities/budget/model/record';
import type { CrewColor } from '@/shared/types';
import { prepareProjectSnapshot } from '../model/conversion';
import { getProjectLocalDateKey, normalizeProjectCompletionDate } from '../model/history';
import {
  assertValidProjectAssignmentSnapshot,
  buildProjectAssignment,
  findAssignmentWithOverlappingMember,
} from '../model/assignments';
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
import { buildProjectWorkItems, type ProjectProgressState } from '../model/structure';
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
  const assignmentRevisionChanged = 'La lista de asignaciones cambió durante la operación.';
  const maxAssignmentRevisionAttempts = 3;

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
    const resourceIds = new Set<string>();
    const memberIds = new Set<string>();
    for (const assignment of assignments) {
      assertValidProjectAssignmentSnapshot(assignment);
      const resourceKey = `${assignment.resourceType}:${assignment.resourceId}`;
      if (resourceIds.has(resourceKey))
        throw new Error('No se puede asignar dos veces el mismo recurso a este proyecto.');
      resourceIds.add(resourceKey);
      if (assignment.members.some(({ id }) => memberIds.has(id)))
        throw new Error('No se puede asignar a una persona más de una vez en el mismo día.');
      assignment.members.forEach(({ id }) => memberIds.add(id));
    }
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
      const budget = budgetSnapshot.data() as BudgetRoot;
      if (budget.projectId !== projectId)
        throw new Error('El presupuesto de origen no está vinculado a este proyecto.');

      const metadata = {
        title: normalizedTitle,
        address: normalizedTitle,
        clientName: normalizedClientName,
      };
      transaction.update(projectRef, metadata);
      const budgetRevision = budget.revision + 1;
      transaction.update(budgetRef, {
        address: normalizedTitle,
        clientName: normalizedClientName,
        revision: budgetRevision,
        updatedAt: new Date().toISOString(),
      });
      return { ...metadata, budgetRevision };
    });
  }

  async function loadBudgetDocument(uid: string, budgetId: string) {
    const stored = await readStoredDocument<BudgetRoot>(
      doc(database, 'users', uid, 'budgets', budgetId),
    );
    if (!stored) throw new Error('No se ha encontrado el presupuesto de origen.');
    return stored;
  }

  /** Converts an accepted budget. The project references the locked budget document. */
  async function convertBudgetToProject(
    uid: string,
    budgetId: string,
  ): Promise<{ projectId: string; budgetRevision: number }> {
    const budgetRef = doc(database, 'users', uid, 'budgets', budgetId);
    const projects = projectsCollection(database, uid);
    const candidateProjectRef = doc(projects, budgetId);
    const convertedAt = new Date().toISOString();
    const source = await loadBudgetDocument(uid, budgetId);

    try {
      return await runTransaction(database, async (transaction) => {
        const budgetSnapshot = await transaction.get(budgetRef);
        if (!budgetSnapshot.exists()) throw new Error('No se ha encontrado el presupuesto.');
        const root = budgetSnapshot.data() as BudgetRoot;

        if (root.projectId) {
          const existingProject = await transaction.get(doc(projects, root.projectId));
          if (!existingProject.exists())
            throw new Error('No se ha encontrado el proyecto vinculado a este presupuesto.');
          return { projectId: root.projectId, budgetRevision: root.revision };
        }
        if (root.revision !== source.root.revision)
          throw new Error('El presupuesto ha cambiado. Recarga e inténtalo de nuevo.');

        const view = budgetView({
          id: root.id,
          revision: root.revision,
          number: root.number,
          createdAt: root.createdAt,
          updatedAt: root.updatedAt,
          ...(root.acceptedAt ? { acceptedAt: root.acceptedAt } : {}),
          document: source.document,
        });
        const snapshot = prepareProjectSnapshot(view, candidateProjectRef.id, convertedAt);
        const collision = await transaction.get(candidateProjectRef);
        if (collision.exists())
          throw new Error('No se ha podido crear el proyecto. Vuelve a intentarlo.');

        const budgetRevision = root.revision + 1;
        transaction.set(candidateProjectRef, snapshot.project);
        transaction.set(doc(candidateProjectRef, 'progress', 'state'), {
          completed: {},
          updatedAt: convertedAt,
        } satisfies ProjectProgressState);
        transaction.update(budgetRef, {
          projectId: candidateProjectRef.id,
          revision: budgetRevision,
          updatedAt: convertedAt,
        });

        return { projectId: candidateProjectRef.id, budgetRevision };
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
        return {
          projectId: candidateProjectRef.id,
          budgetRevision: (currentBudget.data() as BudgetRoot).revision,
        };
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

  interface ProjectStructure {
    project: Project;
    document: ConstructionDocument;
    supplements: ProjectSupplement[];
    supplementVoids: ProjectSupplementVoid[];
  }

  async function loadStructure(uid: string, projectId: string): Promise<ProjectStructure | null> {
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const snapshot = await getDoc(projectRef);
    if (!snapshot.exists()) return null;
    const project = { ...snapshot.data(), id: snapshot.id } as Project;
    const [source, supplementsSnapshot, voidsSnapshot] = await Promise.all([
      loadBudgetDocument(uid, project.sourceBudgetId),
      getDocs(collection(projectRef, 'supplements')),
      getDocs(collection(projectRef, 'supplementVoids')),
    ]);
    if (source.root.projectId !== projectId)
      throw new Error('El presupuesto de origen no está vinculado a este proyecto.');
    return {
      project,
      document: source.document,
      supplements: supplementsSnapshot.docs
        .map((supplement) => ({ ...supplement.data(), id: supplement.id }) as ProjectSupplement)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      supplementVoids: voidsSnapshot.docs.map(
        (supplementVoid) => supplementVoid.data() as ProjectSupplementVoid,
      ),
    };
  }

  function progressRef(uid: string, projectId: string) {
    return doc(projectsCollection(database, uid), projectId, 'progress', 'state');
  }

  async function fetchProject(uid: string, projectId: string): Promise<ProjectDetail | null> {
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const [structure, progressSnapshot, assignmentsSnapshot] = await Promise.all([
      loadStructure(uid, projectId),
      getDoc(progressRef(uid, projectId)),
      getDocs(collection(projectRef, 'assignments')),
    ]);
    if (!structure) return null;
    const completed =
      (progressSnapshot.data() as ProjectProgressState | undefined)?.completed ?? {};
    const assignments = assignmentsSnapshot.docs
      .map((assignment) => ({ ...assignment.data(), id: assignment.id }) as ProjectAssignment)
      .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
    return {
      ...structure.project,
      workItems: buildProjectWorkItems(
        structure.document,
        structure.supplements,
        structure.supplementVoids,
        completed,
      ),
      assignments,
      supplements: structure.supplements,
      supplementVoids: structure.supplementVoids,
    };
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
    const assignmentStateRef = doc(collection(projectRef, 'assignmentState'), 'current');
    const assignedAt = new Date().toISOString();

    for (let attempt = 0; attempt < maxAssignmentRevisionAttempts; attempt += 1) {
      const stateSnapshot = await getDocFromServer(assignmentStateRef);
      const expectedRevision = stateSnapshot.exists() ? stateSnapshot.data().revision : 0;
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
        throw new Error('El estado de las asignaciones del proyecto no es válido.');
      const assignmentsSnapshot = await getDocsFromServer(collection(projectRef, 'assignments'));
      const projectAssignments = assignmentsSnapshot.docs.map(
        (snapshot) => ({ ...snapshot.data(), id: snapshot.id }) as ProjectAssignment,
      );

      try {
        return await runTransaction(database, async (transaction) => {
          const [projectSnapshot, currentState, existingAssignment] = await Promise.all([
            transaction.get(projectRef),
            transaction.get(assignmentStateRef),
            transaction.get(assignmentRef),
          ]);
          if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
          const currentRevision = currentState.exists() ? currentState.data().revision : 0;
          if (currentRevision !== expectedRevision) throw new Error(assignmentRevisionChanged);
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
              memberIds.map((id) =>
                transaction.get(doc(database, 'users', uid, 'teamMembers', id)),
              ),
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
            assignment = buildProjectAssignment(
              { resourceType, resource: crew, members },
              assignedAt,
            );
          }

          const overlappingAssignment = findAssignmentWithOverlappingMember(
            assignment.members.map((member) => member.id),
            projectAssignments,
            assignmentId,
          );
          if (overlappingAssignment) {
            if (resourceType === 'member')
              throw new Error(
                'La persona ya está incluida en una cuadrilla asignada a este proyecto.',
              );
            if (overlappingAssignment.resourceType === 'member')
              throw new Error(
                'La cuadrilla incluye una persona ya asignada individualmente al proyecto.',
              );
            throw new Error(
              'La cuadrilla comparte integrantes con otra cuadrilla asignada al proyecto.',
            );
          }

          transaction.set(assignmentRef, assignment);
          transaction.set(assignmentStateRef, { revision: expectedRevision + 1 });
          return assignment;
        });
      } catch (error) {
        if (error instanceof Error && error.message === assignmentRevisionChanged) continue;
        throw error;
      }
    }

    throw new Error('No se ha podido actualizar la lista de asignaciones. Vuelve a intentarlo.');
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
    const assignmentStateRef = doc(collection(projectRef, 'assignmentState'), 'current');
    await runTransaction(database, async (transaction) => {
      const [projectSnapshot, assignmentSnapshot, stateSnapshot] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(assignmentRef),
        transaction.get(assignmentStateRef),
      ]);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      if (assignmentSnapshot.exists()) {
        const currentRevision = stateSnapshot.exists() ? stateSnapshot.data().revision : 0;
        if (!Number.isInteger(currentRevision) || currentRevision < 0)
          throw new Error('El estado de las asignaciones del proyecto no es válido.');
        transaction.delete(assignmentRef);
        transaction.set(assignmentStateRef, { revision: currentRevision + 1 });
      }
    });
  }

  /** Applies a change to one chapter's completion map entries and the project summary. */
  async function mutateWorkItem(
    uid: string,
    projectId: string,
    workItemId: string,
    updateTasks: (tasks: ProjectTask[], completedAt: string) => ProjectTask[],
  ): Promise<ProjectProgressMutation> {
    const structure = await loadStructure(uid, projectId);
    if (!structure) throw new Error('No se ha encontrado el proyecto.');
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const stateRef = progressRef(uid, projectId);
    const changedAt = new Date().toISOString();

    return runTransaction(database, async (transaction) => {
      const [projectSnapshot, stateSnapshot] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(stateRef),
      ]);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      const project = { ...projectSnapshot.data(), id: projectSnapshot.id } as Project;
      const completed = (stateSnapshot.data() as ProjectProgressState | undefined)?.completed ?? {};
      const workItem = buildProjectWorkItems(
        structure.document,
        structure.supplements,
        structure.supplementVoids,
        completed,
      ).find((item) => item.id === workItemId);
      if (!workItem) throw new Error('No se ha encontrado el capítulo.');
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
        const nextCompleted = { ...completed };
        for (const task of tasks)
          if (task.completedAt) nextCompleted[task.id] = task.completedAt;
          else delete nextCompleted[task.id];
        transaction.set(stateRef, { completed: nextCompleted, updatedAt: changedAt });
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
    const structure = await loadStructure(uid, projectId);
    if (!structure) throw new Error('No se ha encontrado el proyecto.');
    const projectRef = doc(projectsCollection(database, uid), projectId);
    const stateRef = progressRef(uid, projectId);

    return runTransaction(database, async (transaction) => {
      const [projectSnapshot, stateSnapshot] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(stateRef),
      ]);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      const project = { ...projectSnapshot.data(), id: projectSnapshot.id } as Project;
      const completed = (stateSnapshot.data() as ProjectProgressState | undefined)?.completed ?? {};
      const workItems = buildProjectWorkItems(
        structure.document,
        structure.supplements,
        structure.supplementVoids,
        completed,
      );
      const workItemIndex = workItems.findIndex((workItem) => workItem.id === workItemId);
      const before = workItems[workItemIndex];
      if (!before) throw new Error('No se ha encontrado el capítulo.');
      if (before.voidedAt) throw new Error('Esta ampliación está anulada.');
      const after = { ...before, tasks: updateTasks(before.tasks, normalizedDate) };
      const nextWorkItems = [...workItems];
      nextWorkItems[workItemIndex] = after;
      const activeTasks = nextWorkItems
        .filter((workItem) => !workItem.voidedAt)
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

      if (JSON.stringify(after.tasks) !== JSON.stringify(before.tasks)) {
        const nextCompleted = { ...completed };
        for (const task of after.tasks)
          if (task.completedAt) nextCompleted[task.id] = task.completedAt;
        transaction.set(stateRef, {
          completed: nextCompleted,
          updatedAt: new Date().toISOString(),
        });
      }
      if (project.completedAt !== nextCompletedAt) {
        transaction.update(projectRef, { completedAt: nextCompletedAt ?? deleteField() });
      }
      return { project: nextProject, workItem: after };
    });
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

      if (supplementSnapshot.exists()) {
        const existing = {
          ...supplementSnapshot.data(),
          id: supplementSnapshot.id,
        } as ProjectSupplement;
        return {
          project,
          supplement: existing,
          workItem: createSupplementWorkItem(existing, project.workItemCount - 1),
        };
      }
      if (voidSnapshot.exists())
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
    const stateRef = progressRef(uid, projectId);
    const voidedAt = new Date().toISOString();
    const structure = await loadStructure(uid, projectId);
    if (!structure) throw new Error('No se ha encontrado el proyecto.');

    return runTransaction(database, async (transaction) => {
      const [projectSnapshot, supplementSnapshot, voidSnapshot, stateSnapshot] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(supplementRef),
        transaction.get(voidRef),
        transaction.get(stateRef),
      ]);
      if (!projectSnapshot.exists()) throw new Error('No se ha encontrado el proyecto.');
      if (!supplementSnapshot.exists()) throw new Error('No se ha encontrado la ampliación.');
      const project = { ...projectSnapshot.data(), id: projectSnapshot.id } as Project;
      const supplement = {
        ...supplementSnapshot.data(),
        id: supplementSnapshot.id,
      } as ProjectSupplement;
      const completed = (stateSnapshot.data() as ProjectProgressState | undefined)?.completed ?? {};
      const supplementVoids = voidSnapshot.exists()
        ? [voidSnapshot.data() as ProjectSupplementVoid]
        : structure.supplementVoids.filter((item) => item.supplementId !== supplementId);
      const workItems = buildProjectWorkItems(
        structure.document,
        structure.supplements.some((item) => item.id === supplementId)
          ? structure.supplements
          : [...structure.supplements, supplement],
        supplementVoids,
        completed,
      );
      const workItem = workItems.find((item) => item.supplementId === supplementId);
      if (!workItem) throw new Error('No se ha encontrado el trabajo añadido.');

      if (voidSnapshot.exists()) {
        const existingVoid = voidSnapshot.data() as ProjectSupplementVoid;
        if (existingVoid.reason !== normalizedReason)
          throw new Error('La ampliación ya se anuló con otro motivo.');
        return { project, supplementVoid: existingVoid, workItem };
      }

      const supplementVoid: ProjectSupplementVoid = {
        supplementId,
        reason: normalizedReason,
        voidedAt,
      };
      const activeWorkItems = workItems.filter((item) => !item.voidedAt);
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
      const remainingTasks = activeWorkItems
        .filter((item) => item.id !== workItem.id)
        .flatMap((item) => item.tasks);
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
      transaction.update(projectRef, update);

      return {
        project: nextProject,
        supplementVoid,
        workItem: { ...workItem, voidedAt },
      };
    });
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

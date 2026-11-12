import { create } from 'zustand';
import { db } from '@/shared/firebase/config';
import { isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import { createProjectFirestoreApi } from '../api/firestore';
import { useBudgetStore } from '@/entities/budget';
import {
  getMemoryResource,
  loadMemoryResource,
  setMemoryResource,
} from '@/shared/lib/memoryResourceCache';
import { registerOfflineStore } from '@/shared/lib/offlineStateCache';
import { isBrowserDisconnected } from '@/shared/model/network';
import type {
  NewProjectSupplement,
  Project,
  ProjectAssignment,
  ProjectDailyAssignmentOverride,
  ProjectDetail,
  ProjectProgressMutation,
  ProjectSupplementMutation,
  ProjectSupplementVoidMutation,
  ProjectTeamScheduleData,
} from './types';
import { normalizeEstimatedEndDate } from './estimatedEndDate';

interface ProjectState {
  projects: Project[];
  activeProject: ProjectDetail | null;
  loaded: boolean;
  loadProjects: (uid: string, force?: boolean) => Promise<void>;
  loadProject: (uid: string, projectId: string) => Promise<ProjectDetail | null>;
  loadTeamSchedule: (
    uid: string,
    projectIds: string[],
    dateKeys: string[],
  ) => Promise<ProjectTeamScheduleData | null>;
  saveDailyAssignments: (
    projectId: string,
    dateKey: string,
    assignments: ProjectAssignment[],
  ) => Promise<ProjectDailyAssignmentOverride | undefined>;
  removeDailyAssignmentOverride: (projectId: string, dateKey: string) => Promise<void>;
  setEstimatedEndDate: (projectId: string, date: string) => Promise<void>;
  updateProjectMetadata: (projectId: string, title: string, clientName: string) => Promise<void>;
  addAssignment: (
    projectId: string,
    resourceType: ProjectAssignment['resourceType'],
    resourceId: string,
  ) => Promise<void>;
  removeAssignment: (projectId: string, assignmentId: string) => Promise<void>;
  convertBudgetToProject: (budgetId: string) => Promise<string>;
  toggleTask: (projectId: string, workItemId: string, taskId: string) => Promise<void>;
  completeWorkItem: (projectId: string, workItemId: string) => Promise<void>;
  setTaskCompletionDate: (
    projectId: string,
    workItemId: string,
    taskId: string,
    completedAt: string,
  ) => Promise<void>;
  setWorkItemCompletionDate: (
    projectId: string,
    workItemId: string,
    completedAt: string,
  ) => Promise<void>;
  addSupplement: (
    projectId: string,
    supplementId: string,
    input: NewProjectSupplement,
  ) => Promise<void>;
  voidSupplement: (projectId: string, supplementId: string, reason: string) => Promise<void>;
}

const api = createProjectFirestoreApi(db);
const initial = {
  projects: [] as Project[],
  activeProject: null as ProjectDetail | null,
  loaded: false,
};

export function resetProjectStore() {
  useProjectStore.setState(initial);
}

function applyMutation(
  current: ProjectState,
  mutation: ProjectProgressMutation,
  projectId: string,
): Partial<ProjectState> {
  const projects = current.projects.some((project) => project.id === projectId)
    ? current.projects.map((project) => (project.id === projectId ? mutation.project : project))
    : [...current.projects, mutation.project];
  const activeProject =
    current.activeProject?.id === projectId
      ? {
          ...current.activeProject,
          ...mutation.project,
          workItems: current.activeProject.workItems.map((item) =>
            item.id === mutation.workItem.id ? mutation.workItem : item,
          ),
        }
      : current.activeProject;
  return { projects, activeProject };
}

function mergeById<T>(items: T[], item: T, getId: (value: T) => string): T[] {
  return items.some((existing) => getId(existing) === getId(item))
    ? items.map((existing) => (getId(existing) === getId(item) ? item : existing))
    : [...items, item];
}

function applySupplementMutation(
  current: ProjectState,
  mutation: ProjectSupplementMutation,
  projectId: string,
): Partial<ProjectState> {
  const projects = current.projects.some((project) => project.id === projectId)
    ? current.projects.map((project) => (project.id === projectId ? mutation.project : project))
    : [mutation.project, ...current.projects];
  const activeProject =
    current.activeProject?.id === projectId
      ? {
          ...current.activeProject,
          ...mutation.project,
          workItems: mergeById(
            current.activeProject.workItems,
            mutation.workItem,
            (item) => item.id,
          ),
          supplements: mergeById(
            current.activeProject.supplements,
            mutation.supplement,
            (supplement) => supplement.id,
          ),
        }
      : current.activeProject;
  return { projects, activeProject };
}

function applySupplementVoidMutation(
  current: ProjectState,
  mutation: ProjectSupplementVoidMutation,
  projectId: string,
): Partial<ProjectState> {
  const projects = current.projects.some((project) => project.id === projectId)
    ? current.projects.map((project) => (project.id === projectId ? mutation.project : project))
    : [mutation.project, ...current.projects];
  const activeProject =
    current.activeProject?.id === projectId
      ? {
          ...current.activeProject,
          ...mutation.project,
          workItems: mergeById(
            current.activeProject.workItems,
            mutation.workItem,
            (item) => item.id,
          ),
          supplementVoids: mergeById(
            current.activeProject.supplementVoids,
            mutation.supplementVoid,
            (supplementVoid) => supplementVoid.supplementId,
          ),
        }
      : current.activeProject;
  return { projects, activeProject };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  ...initial,
  loadProjects: async (uid, force = false) => {
    if (get().loaded && sessionUid() === uid && (!force || isBrowserDisconnected())) return;
    const revision = sessionRevision();
    const projects = await api.fetchProjects(uid);
    if (!isSessionCurrent(uid, revision)) return;
    set({ projects, loaded: true });
  },
  loadProject: async (uid, projectId) => {
    const revision = sessionRevision();
    const project = await loadMemoryResource(`private:${uid}:project:${projectId}`, () =>
      api.fetchProject(uid, projectId),
    );
    if (!isSessionCurrent(uid, revision)) return null;
    set({ activeProject: project });
    return project;
  },
  loadTeamSchedule: async (uid, projectIds, dateKeys) => {
    const revision = sessionRevision();
    const schedule = await api.fetchTeamSchedule(uid, projectIds, dateKeys);
    if (!isSessionCurrent(uid, revision)) return null;
    return schedule;
  },
  saveDailyAssignments: async (projectId, dateKey, assignments) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const override = await api.saveDailyAssignments(uid, projectId, dateKey, assignments);
    if (!isSessionCurrent(uid, revision)) return undefined;
    return override;
  },
  removeDailyAssignmentOverride: async (projectId, dateKey) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    await api.removeDailyAssignmentOverride(uid, projectId, dateKey);
    if (!isSessionCurrent(uid, revision)) return;
  },
  setEstimatedEndDate: async (projectId, date) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const estimatedEndDate = normalizeEstimatedEndDate(date);
    await api.setEstimatedEndDate(uid, projectId, estimatedEndDate);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, estimatedEndDate } : project,
      ),
      activeProject:
        state.activeProject?.id === projectId
          ? { ...state.activeProject, estimatedEndDate }
          : state.activeProject,
    }));
  },
  updateProjectMetadata: async (projectId, title, clientName) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const { budgetRevision, ...metadata } = await api.updateProjectMetadata(
      uid,
      projectId,
      title,
      clientName,
    );
    if (!isSessionCurrent(uid, revision)) return;
    const sourceBudgetId = get().projects.find(
      (project) => project.id === projectId,
    )?.sourceBudgetId;
    if (sourceBudgetId)
      useBudgetStore
        .getState()
        .syncLinkedProjectMetadata(
          sourceBudgetId,
          { address: metadata.address, clientName: metadata.clientName },
          budgetRevision,
        );
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, ...metadata } : project,
      ),
      activeProject:
        state.activeProject?.id === projectId
          ? { ...state.activeProject, ...metadata }
          : state.activeProject,
    }));
    const cacheKey = `private:${uid}:project:${projectId}`;
    const cachedProject = getMemoryResource<ProjectDetail>(cacheKey);
    if (cachedProject?.id === projectId)
      await setMemoryResource(cacheKey, { ...cachedProject, ...metadata });
  },
  addAssignment: async (projectId, resourceType, resourceId) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const assignment = await api.addAssignment(uid, projectId, resourceType, resourceId);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => ({
      activeProject:
        state.activeProject?.id === projectId
          ? {
              ...state.activeProject,
              assignments: mergeById(
                state.activeProject.assignments,
                assignment,
                (item) => item.id,
              ),
            }
          : state.activeProject,
    }));
  },
  removeAssignment: async (projectId, assignmentId) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    await api.removeAssignment(uid, projectId, assignmentId);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => ({
      activeProject:
        state.activeProject?.id === projectId
          ? {
              ...state.activeProject,
              assignments: state.activeProject.assignments.filter(
                (item) => item.id !== assignmentId,
              ),
            }
          : state.activeProject,
    }));
  },
  convertBudgetToProject: async (budgetId) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const { projectId, budgetRevision } = await api.convertBudgetToProject(uid, budgetId);
    if (!isSessionCurrent(uid, revision)) return projectId;
    useBudgetStore.getState().linkProject(budgetId, projectId, budgetRevision);
    const project = await api.fetchProject(uid, projectId);
    if (project && isSessionCurrent(uid, revision)) {
      set((state) => ({
        activeProject: project,
        projects: state.projects.some((item) => item.id === projectId)
          ? state.projects.map((item) => (item.id === projectId ? projectSummary(project) : item))
          : [projectSummary(project), ...state.projects],
        loaded: true,
      }));
    }
    return projectId;
  },
  toggleTask: async (projectId, workItemId, taskId) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const mutation = await api.toggleTask(uid, projectId, workItemId, taskId);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => applyMutation(state, mutation, projectId));
  },
  completeWorkItem: async (projectId, workItemId) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const mutation = await api.completeWorkItem(uid, projectId, workItemId);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => applyMutation(state, mutation, projectId));
  },
  setTaskCompletionDate: async (projectId, workItemId, taskId, completedAt) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const mutation = await api.setTaskCompletionDate(
      uid,
      projectId,
      workItemId,
      taskId,
      completedAt,
    );
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => applyMutation(state, mutation, projectId));
  },
  setWorkItemCompletionDate: async (projectId, workItemId, completedAt) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const mutation = await api.setWorkItemCompletionDate(uid, projectId, workItemId, completedAt);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => applyMutation(state, mutation, projectId));
  },
  addSupplement: async (projectId, supplementId, input) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const mutation = await api.addSupplement(uid, projectId, supplementId, input);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => applySupplementMutation(state, mutation, projectId));
  },
  voidSupplement: async (projectId, supplementId, reason) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const mutation = await api.voidSupplement(uid, projectId, supplementId, reason);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => applySupplementVoidMutation(state, mutation, projectId));
  },
}));

useProjectStore.subscribe((state) => {
  const uid = sessionUid();
  if (uid && state.activeProject)
    setMemoryResource(`private:${uid}:project:${state.activeProject.id}`, state.activeProject);
});

registerOfflineStore('projects', useProjectStore, sessionUid, (state) => ({
  projects: state.projects,
  activeProject: state.activeProject,
  loaded: state.loaded,
}));

function projectSummary(project: ProjectDetail): Project {
  const summary = { ...project };
  Reflect.deleteProperty(summary, 'workItems');
  Reflect.deleteProperty(summary, 'assignments');
  Reflect.deleteProperty(summary, 'supplements');
  Reflect.deleteProperty(summary, 'supplementVoids');
  return summary;
}

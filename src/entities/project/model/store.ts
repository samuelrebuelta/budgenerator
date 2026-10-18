import { create } from 'zustand';
import { db } from '@/shared/firebase/config';
import { isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import { createProjectFirestoreApi } from '../api/firestore';
import type {
  NewProjectSupplement,
  Project,
  ProjectDetail,
  ProjectProgressMutation,
  ProjectSupplementMutation,
  ProjectSupplementVoidMutation,
} from './types';

interface ProjectState {
  projects: Project[];
  activeProject: ProjectDetail | null;
  loaded: boolean;
  loadProjects: (uid: string) => Promise<void>;
  loadProject: (uid: string, projectId: string) => Promise<ProjectDetail | null>;
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
  loadProjects: async (uid) => {
    if (get().loaded && sessionUid() === uid) return;
    const revision = sessionRevision();
    const projects = await api.fetchProjects(uid);
    if (!isSessionCurrent(uid, revision)) return;
    set({ projects, loaded: true });
  },
  loadProject: async (uid, projectId) => {
    const revision = sessionRevision();
    const project = await api.fetchProject(uid, projectId);
    if (!isSessionCurrent(uid, revision)) return null;
    set({ activeProject: project });
    return project;
  },
  convertBudgetToProject: async (budgetId) => {
    const uid = sessionUid();
    if (!uid) throw new Error('Inicia sesión para continuar.');
    const revision = sessionRevision();
    const projectId = await api.convertBudgetToProject(uid, budgetId);
    if (!isSessionCurrent(uid, revision)) return projectId;
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

function projectSummary(project: ProjectDetail): Project {
  const summary = { ...project };
  Reflect.deleteProperty(summary, 'workItems');
  Reflect.deleteProperty(summary, 'supplements');
  Reflect.deleteProperty(summary, 'supplementVoids');
  return summary;
}

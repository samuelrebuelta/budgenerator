import { create } from 'zustand';
import { db } from '@/shared/firebase/config';
import { isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import { registerOfflineStore } from '@/shared/lib/offlineStateCache';
import {
  getMemoryResource,
  loadMemoryResource,
  setMemoryResource,
} from '@/shared/lib/memoryResourceCache';
import { isBrowserDisconnected } from '@/shared/model/network';
import { createWorkforceFirestoreApi } from '../api/firestore';
import type { TeamJob, WorkCrew, WorkforceMember } from './types';
import { validateCrewInput, validateMemberName } from './validation';

interface WorkforceState {
  members: WorkforceMember[];
  crews: WorkCrew[];
  teamJobs: TeamJob[];
  teamJobsRange: { uid: string; startDate: string; endDate: string } | null;
  loaded: boolean;
  loadedUid: string | null;
  loadWorkforce: (uid: string) => Promise<void>;
  loadTeamJobs: (uid: string, startDate: string, endDate: string) => Promise<TeamJob[]>;
  createTeamJob: (job: TeamJob) => Promise<TeamJob>;
  saveMember: (member: WorkforceMember) => Promise<WorkforceMember>;
  saveCrew: (crew: WorkCrew) => Promise<void>;
  setMemberStatus: (id: string, status: WorkforceMember['status']) => Promise<void>;
  setCrewStatus: (id: string, status: WorkCrew['status']) => Promise<void>;
}

const api = createWorkforceFirestoreApi(db);
const initial = {
  members: [] as WorkforceMember[],
  crews: [] as WorkCrew[],
  teamJobs: [] as TeamJob[],
  teamJobsRange: null as WorkforceState['teamJobsRange'],
  loaded: false,
  loadedUid: null as string | null,
};

export function resetWorkforceStore() {
  useWorkforceStore.setState(initial);
}

function getCurrentUid() {
  const uid = sessionUid();
  if (!uid) throw new Error('Inicia sesión para gestionar el equipo.');
  return uid;
}

function mergeById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
}

function hasSameMemberIds(left: string[], right: string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function teamJobsResourceKey(uid: string, startDate: string, endDate: string) {
  return `private:${uid}:team-jobs:${startDate}:${endDate}`;
}

export const useWorkforceStore = create<WorkforceState>((set, get) => ({
  ...initial,
  loadWorkforce: async (uid) => {
    if (get().loaded && get().loadedUid === uid && sessionUid() === uid && isBrowserDisconnected())
      return;
    const revision = sessionRevision();
    const workforce = await loadMemoryResource(`private:${uid}:workforce`, async () => {
      const [members, crews] = await Promise.all([api.fetchMembers(uid), api.fetchCrews(uid)]);
      return { members, crews };
    });
    if (!isSessionCurrent(uid, revision)) return;
    set({ ...workforce, loaded: true, loadedUid: uid });
  },
  loadTeamJobs: async (uid, startDate, endDate) => {
    const revision = sessionRevision();
    const key = teamJobsResourceKey(uid, startDate, endDate);
    const range = { uid, startDate, endDate };
    const cached = getMemoryResource<TeamJob[]>(key);
    if (cached !== undefined && isSessionCurrent(uid, revision))
      set({ teamJobs: cached, teamJobsRange: range });
    const jobs = await loadMemoryResource(key, () => api.fetchTeamJobs(uid, startDate, endDate));
    if (isSessionCurrent(uid, revision)) set({ teamJobs: jobs, teamJobsRange: range });
    return jobs;
  },
  createTeamJob: async (job) => {
    const uid = getCurrentUid();
    const revision = sessionRevision();
    const saved = await api.createTeamJob(uid, job);
    if (!isSessionCurrent(uid, revision)) return saved;
    const range = get().teamJobsRange;
    if (range?.uid === uid && saved.date >= range.startDate && saved.date <= range.endDate) {
      const next = mergeById(get().teamJobs, saved);
      await setMemoryResource(teamJobsResourceKey(uid, range.startDate, range.endDate), next);
      if (isSessionCurrent(uid, revision)) set({ teamJobs: next });
    }
    return saved;
  },
  saveMember: async (member) => {
    const uid = getCurrentUid();
    const revision = sessionRevision();
    const nextMember = { ...member, name: validateMemberName(member.name) };
    await api.saveMember(uid, nextMember);
    if (!isSessionCurrent(uid, revision)) return nextMember;
    set((state) => ({ members: mergeById(state.members, nextMember) }));
    return nextMember;
  },
  saveCrew: async (crew) => {
    const uid = getCurrentUid();
    const revision = sessionRevision();
    const current = get().crews.find((item) => item.id === crew.id);
    const sameSavedMembers = current ? hasSameMemberIds(current.memberIds, crew.memberIds) : false;
    const validated = validateCrewInput(crew, get().members, {
      requireActive: !sameSavedMembers,
    });
    const nextCrew = { ...crew, ...validated };
    await api.saveCrew(uid, nextCrew);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => ({ crews: mergeById(state.crews, nextCrew) }));
  },
  setMemberStatus: async (id, status) => {
    const uid = getCurrentUid();
    const revision = sessionRevision();
    await api.setMemberStatus(uid, id, status);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => ({
      members: state.members.map((member) =>
        member.id === id ? { ...member, status, updatedAt: new Date().toISOString() } : member,
      ),
    }));
  },
  setCrewStatus: async (id, status) => {
    const uid = getCurrentUid();
    const revision = sessionRevision();
    await api.setCrewStatus(uid, id, status);
    if (!isSessionCurrent(uid, revision)) return;
    set((state) => ({
      crews: state.crews.map((crew) =>
        crew.id === id ? { ...crew, status, updatedAt: new Date().toISOString() } : crew,
      ),
    }));
  },
}));

registerOfflineStore('workforce', useWorkforceStore, sessionUid, (state) => ({
  members: state.members,
  crews: state.crews,
  teamJobs: state.teamJobs,
  teamJobsRange: state.teamJobsRange,
  loaded: state.loaded,
  loadedUid: state.loadedUid,
}));

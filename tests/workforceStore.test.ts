import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  TeamJob,
  TeamJobAssignment,
  WorkCrew,
  WorkforceMember,
} from '../src/entities/workforce/model/types';

const mocks = vi.hoisted(() => ({
  api: {
    fetchMembers: vi.fn(),
    fetchCrews: vi.fn(),
    fetchTeamJobs: vi.fn(),
    createTeamJob: vi.fn(),
    saveMember: vi.fn(),
    saveCrew: vi.fn(),
    setMemberStatus: vi.fn(),
    setCrewStatus: vi.fn(),
  },
}));

vi.mock('../src/shared/firebase/config', () => ({ db: {} }));
vi.mock('../src/entities/workforce/api/firestore', () => ({
  createWorkforceFirestoreApi: () => mocks.api,
}));

import { clearMemoryResources } from '../src/shared/lib/memoryResourceCache';
import { resetWorkforceStore, useWorkforceStore } from '../src/entities/workforce/model/store';
import { setSessionUid } from '../src/shared/model/session';

const member = (
  id = 'member-1',
  status: WorkforceMember['status'] = 'active',
): WorkforceMember => ({
  id,
  name: 'Ana Pérez',
  status,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
});

const crew: WorkCrew = {
  id: 'crew-1',
  label: 'Alba',
  color: 'blue',
  memberIds: ['member-1'],
  status: 'active',
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
};

const jobAssignment: TeamJobAssignment = {
  id: 'member_member-1',
  resourceType: 'member',
  resourceId: 'member-1',
  label: 'Ana Pérez',
  members: [{ id: 'member-1', name: 'Ana Pérez' }],
  assignedAt: '2026-11-07T10:00:00.000Z',
};

const job: TeamJob = {
  id: 'job-1',
  title: 'Remate',
  description: 'Repasar una junta.',
  date: '2026-11-07',
  assignments: [jobAssignment],
  createdAt: '2026-11-07T10:00:00.000Z',
  updatedAt: '2026-11-07T10:00:00.000Z',
};

describe('workforce store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryResources();
    setSessionUid('alice');
    resetWorkforceStore();
    mocks.api.fetchMembers.mockResolvedValue([]);
    mocks.api.fetchCrews.mockResolvedValue([]);
    mocks.api.fetchTeamJobs.mockResolvedValue([]);
    mocks.api.createTeamJob.mockImplementation(async (_uid: string, next: TeamJob) => next);
    mocks.api.saveMember.mockResolvedValue(undefined);
    mocks.api.saveCrew.mockResolvedValue(undefined);
    mocks.api.setMemberStatus.mockResolvedValue(undefined);
    mocks.api.setCrewStatus.mockResolvedValue(undefined);
  });

  it('loads the member and crew roster for the active session', async () => {
    mocks.api.fetchMembers.mockResolvedValueOnce([member()]);
    mocks.api.fetchCrews.mockResolvedValueOnce([crew]);
    await useWorkforceStore.getState().loadWorkforce('alice');
    expect(useWorkforceStore.getState()).toMatchObject({
      members: [member()],
      crews: [crew],
      loaded: true,
    });
  });

  it('returns the normalized member after saving it for immediate assignment', async () => {
    const saved = await useWorkforceStore.getState().saveMember({
      ...member('member-new'),
      name: '  Diego   Ruiz  ',
    });

    expect(saved).toMatchObject({ id: 'member-new', name: 'Diego Ruiz', status: 'active' });
    expect(useWorkforceStore.getState().members).toEqual([saved]);
  });

  it('loads work entries for a week into the local store cache', async () => {
    mocks.api.fetchTeamJobs.mockResolvedValueOnce([job]);
    await expect(
      useWorkforceStore.getState().loadTeamJobs('alice', '2026-11-02', '2026-11-08'),
    ).resolves.toEqual([job]);
    expect(mocks.api.fetchTeamJobs).toHaveBeenCalledWith('alice', '2026-11-02', '2026-11-08');
    expect(useWorkforceStore.getState()).toMatchObject({
      teamJobs: [job],
      teamJobsRange: { uid: 'alice', startDate: '2026-11-02', endDate: '2026-11-08' },
    });
  });

  it('adds a saved job to the currently loaded week only after persistence succeeds', async () => {
    await useWorkforceStore.getState().loadTeamJobs('alice', '2026-11-02', '2026-11-08');
    await useWorkforceStore.getState().createTeamJob(job);
    expect(mocks.api.createTeamJob).toHaveBeenCalledWith('alice', job);
    expect(useWorkforceStore.getState().teamJobs).toEqual([job]);

    mocks.api.createTeamJob.mockRejectedValueOnce(new Error('denied'));
    await expect(
      useWorkforceStore.getState().createTeamJob({ ...job, id: 'job-failed' }),
    ).rejects.toThrow('denied');
    expect(useWorkforceStore.getState().teamJobs).toEqual([job]);
  });

  it('saves and edits a member in local state after persistence', async () => {
    useWorkforceStore.setState({ members: [member()], loaded: true });
    await useWorkforceStore.getState().saveMember({ ...member(), name: ' Ana   Pérez ' });
    expect(mocks.api.saveMember).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({ name: 'Ana Pérez' }),
    );
    expect(useWorkforceStore.getState().members).toMatchObject([{ name: 'Ana Pérez' }]);
  });

  it('deduplicates crew member IDs and preserves the crew label and color', async () => {
    useWorkforceStore.setState({ members: [member()], loaded: true });
    await useWorkforceStore
      .getState()
      .saveCrew({ ...crew, label: 'Alba   mañana', memberIds: ['member-1', 'member-1'] });
    expect(mocks.api.saveCrew).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({
        label: 'Alba mañana',
        color: 'blue',
        memberIds: ['member-1'],
      }),
    );
    expect(useWorkforceStore.getState().crews[0]).toMatchObject({
      label: 'Alba mañana',
      color: 'blue',
      memberIds: ['member-1'],
    });
  });

  it('applies member and crew activation changes locally after persistence', async () => {
    useWorkforceStore.setState({ members: [member()], crews: [crew], loaded: true });
    await useWorkforceStore.getState().setMemberStatus('member-1', 'inactive');
    await useWorkforceStore.getState().setCrewStatus('crew-1', 'inactive');
    expect(useWorkforceStore.getState().members[0]?.status).toBe('inactive');
    expect(useWorkforceStore.getState().crews[0]?.status).toBe('inactive');
  });

  it('discards roster responses after the session changes', async () => {
    let resolveMembers!: (value: WorkforceMember[]) => void;
    mocks.api.fetchMembers.mockReturnValueOnce(
      new Promise<WorkforceMember[]>((resolve) => {
        resolveMembers = resolve;
      }),
    );
    const pending = useWorkforceStore.getState().loadWorkforce('alice');
    setSessionUid('bob');
    resolveMembers([member()]);
    await pending;
    expect(useWorkforceStore.getState()).toMatchObject({ members: [], crews: [], loaded: false });
  });
});

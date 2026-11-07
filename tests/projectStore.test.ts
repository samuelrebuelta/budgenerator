import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Project,
  ProjectAssignment,
  ProjectDetail,
  ProjectSupplement,
  ProjectSupplementVoid,
  ProjectTeamScheduleData,
  ProjectWorkItem,
} from '../src/entities/project/model/types';

const mocks = vi.hoisted(() => ({
  api: {
    fetchProjects: vi.fn(),
    fetchProject: vi.fn(),
    fetchTeamSchedule: vi.fn(),
    saveDailyAssignments: vi.fn(),
    removeDailyAssignmentOverride: vi.fn(),
    addAssignment: vi.fn(),
    removeAssignment: vi.fn(),
    setEstimatedEndDate: vi.fn(),
    toggleTask: vi.fn(),
    completeWorkItem: vi.fn(),
    setTaskCompletionDate: vi.fn(),
    setWorkItemCompletionDate: vi.fn(),
    addSupplement: vi.fn(),
    voidSupplement: vi.fn(),
  },
}));

vi.mock('../src/shared/firebase/config', () => ({ db: {} }));
vi.mock('../src/entities/project/api/firestore', () => ({
  createProjectFirestoreApi: () => mocks.api,
}));

import { resetProjectStore, useProjectStore } from '../src/entities/project/model/store';
import { setSessionUid } from '../src/shared/model/session';

const project = (): Project => ({
  id: 'project-a',
  sourceBudgetId: 'budget-a',
  sourceBudgetNumber: '1',
  title: 'Reforma integral',
  clientName: 'Estudio de prueba',
  address: 'Madrid',
  budgetDate: '2026-10-14',
  acceptedAt: '2026-10-15T10:00:00.000Z',
  createdAt: '2026-10-16T10:00:00.000Z',
  subtotal: 100,
  iva: 10,
  total: 110,
  ivaRate: 0.1,
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
  updatedTotal: 110,
});

const workItem = (completedAt?: string): ProjectWorkItem => ({
  id: 'work-a',
  name: 'Pintura',
  position: 0,
  tasks: [
    {
      id: 'task-a',
      description: 'Paredes',
      quantity: 1,
      unit: 'm2',
      price: 50,
      cost: 20,
      ...(completedAt ? { completedAt } : {}),
    },
    {
      id: 'task-b',
      description: 'Techo',
      quantity: 1,
      unit: 'm2',
      price: 50,
      cost: 20,
    },
  ],
});

const detail = (completedAt?: string): ProjectDetail => ({
  ...project(),
  ...(completedAt
    ? { completedConcepts: 1, completedAmount: 50, percent: 50, status: 'in_progress' as const }
    : {}),
  workItems: [workItem(completedAt)],
  assignments: [],
  supplements: [],
  supplementVoids: [],
});

const summary = (value: ProjectDetail): Project => {
  const result = { ...value };
  Reflect.deleteProperty(result, 'workItems');
  Reflect.deleteProperty(result, 'assignments');
  return result;
};

function mutationResult(value: ProjectDetail) {
  return { project: summary(value), workItem: value.workItems[0]! };
}

describe('project store', () => {
  beforeEach(() => {
    setSessionUid('alice');
    resetProjectStore();
    vi.clearAllMocks();
    useProjectStore.setState({ projects: [project()], activeProject: detail(), loaded: true });
  });

  it('persists an estimated end date and updates list and active detail', async () => {
    const setEstimatedEndDate = Reflect.get(useProjectStore.getState(), 'setEstimatedEndDate') as
      ((projectId: string, date: string) => Promise<void>) | undefined;
    expect(typeof setEstimatedEndDate).toBe('function');
    if (typeof setEstimatedEndDate !== 'function') return;

    mocks.api.setEstimatedEndDate.mockResolvedValueOnce(undefined);
    await setEstimatedEndDate('project-a', '2026-11-30');

    expect(mocks.api.setEstimatedEndDate).toHaveBeenCalledWith('alice', 'project-a', '2026-11-30');
    expect(useProjectStore.getState().projects[0]?.estimatedEndDate).toBe('2026-11-30');
    expect(useProjectStore.getState().activeProject?.estimatedEndDate).toBe('2026-11-30');
  });

  it('toggles and reopens a concept while keeping list and detail summaries consistent', async () => {
    const completedAt = '2026-10-18T10:00:00.000Z';
    mocks.api.toggleTask.mockResolvedValueOnce(mutationResult(detail(completedAt)));
    await useProjectStore.getState().toggleTask('project-a', 'work-a', 'task-a');

    expect(useProjectStore.getState().activeProject).toMatchObject({
      completedConcepts: 1,
      completedAmount: 50,
      percent: 50,
      status: 'in_progress',
    });
    expect(useProjectStore.getState().projects[0]).toMatchObject({
      percent: 50,
      status: 'in_progress',
    });
    expect(useProjectStore.getState().activeProject?.workItems[0]?.tasks[0]?.completedAt).toBe(
      completedAt,
    );

    mocks.api.toggleTask.mockResolvedValueOnce(mutationResult(detail()));
    await useProjectStore.getState().toggleTask('project-a', 'work-a', 'task-a');
    expect(useProjectStore.getState().activeProject).toMatchObject({
      completedConcepts: 0,
      completedAmount: 0,
      percent: 0,
      status: 'pending',
    });
    expect(
      useProjectStore.getState().activeProject?.workItems[0]?.tasks[0]?.completedAt,
    ).toBeUndefined();
  });

  it('marks all concepts in a work item complete and applies the response to active detail', async () => {
    const completedAt = '2026-10-18T10:00:00.000Z';
    const complete = {
      ...detail(completedAt),
      completedConcepts: 2,
      completedAmount: 100,
      percent: 100,
      status: 'completed' as const,
      completedAt,
      workItems: [
        {
          ...workItem(completedAt),
          tasks: workItem(completedAt).tasks.map((task) => ({ ...task, completedAt })),
        },
      ],
    };
    mocks.api.completeWorkItem.mockResolvedValueOnce(mutationResult(complete));
    await useProjectStore.getState().completeWorkItem('project-a', 'work-a');

    expect(useProjectStore.getState().activeProject).toMatchObject({
      completedConcepts: 2,
      percent: 100,
      status: 'completed',
      completedAt,
    });
    expect(
      useProjectStore
        .getState()
        .activeProject?.workItems[0]?.tasks.every((task) => task.completedAt),
    ).toBe(true);
  });

  it('applies edited task and work-item completion dates to detail and project summaries', async () => {
    const firstDate = '2026-10-17';
    const secondDate = '2026-10-16';
    const completedDetail: ProjectDetail = {
      ...detail(firstDate),
      completedConcepts: 2,
      completedAmount: 100,
      percent: 100,
      status: 'completed',
      completedAt: secondDate,
      workItems: [
        {
          ...workItem(firstDate),
          tasks: workItem(firstDate).tasks.map((task) => ({ ...task, completedAt: firstDate })),
        },
      ],
    };
    const correctedDetail: ProjectDetail = {
      ...completedDetail,
      completedAt: secondDate,
      workItems: [
        {
          ...completedDetail.workItems[0]!,
          tasks: completedDetail.workItems[0]!.tasks.map((task) => ({
            ...task,
            completedAt: secondDate,
          })),
        },
      ],
    };
    mocks.api.setTaskCompletionDate.mockResolvedValueOnce(mutationResult(detail(firstDate)));
    mocks.api.setWorkItemCompletionDate.mockResolvedValueOnce(mutationResult(correctedDetail));

    await useProjectStore
      .getState()
      .setTaskCompletionDate('project-a', 'work-a', 'task-a', firstDate);
    expect(useProjectStore.getState().activeProject?.workItems[0]?.tasks[0]?.completedAt).toBe(
      firstDate,
    );
    expect(useProjectStore.getState().projects[0]?.completedConcepts).toBe(1);

    await useProjectStore.getState().setWorkItemCompletionDate('project-a', 'work-a', secondDate);
    expect(mocks.api.setWorkItemCompletionDate).toHaveBeenCalledWith(
      'alice',
      'project-a',
      'work-a',
      secondDate,
    );
    expect(useProjectStore.getState().activeProject).toMatchObject({ completedAt: secondDate });
    expect(
      useProjectStore
        .getState()
        .activeProject?.workItems[0]?.tasks.every((task) => task.completedAt === secondDate),
    ).toBe(true);
    expect(useProjectStore.getState().projects[0]).toMatchObject({
      completedAt: secondDate,
      completedConcepts: 2,
      status: 'completed',
    });
  });

  it('applies supplement additions and voids to the active project and project list', async () => {
    const supplement: ProjectSupplement = {
      id: 'extra-a',
      description: 'Luz adicional',
      quantity: 1,
      unit: 'unit',
      unitPrice: 40,
      vatRate: 0.1,
      subtotal: 40,
      iva: 4,
      total: 44,
      createdAt: '2026-10-18T10:00:00.000Z',
      workItemId: 'supplement_extra-a',
    };
    const supplementWorkItem: ProjectWorkItem = {
      id: supplement.workItemId,
      name: supplement.description,
      position: 1,
      supplementId: supplement.id,
      tasks: [
        {
          id: 'concept_extra-a',
          description: supplement.description,
          quantity: 1,
          unit: 'unit',
          price: 40,
          cost: 0,
        },
      ],
    };
    const activeProject: Project = {
      ...project(),
      supplementsSubtotal: 40,
      supplementsIva: 4,
      updatedTotal: 154,
      totalConcepts: 3,
      completedConcepts: 1,
      totalAmount: 140,
      completedAmount: 50,
      percent: 36,
      status: 'in_progress',
    };
    mocks.api.addSupplement.mockResolvedValueOnce({
      project: activeProject,
      supplement,
      workItem: supplementWorkItem,
    });

    await useProjectStore.getState().addSupplement('project-a', 'extra-a', {
      description: supplement.description,
      quantity: 1,
      unit: 'unit',
      unitPrice: 40,
    });

    expect(useProjectStore.getState().activeProject).toMatchObject({
      supplements: [{ id: 'extra-a' }],
      workItems: [{ id: 'work-a' }, { id: 'supplement_extra-a' }],
      updatedTotal: 154,
    });
    expect(useProjectStore.getState().projects[0]?.updatedTotal).toBe(154);

    const supplementVoid: ProjectSupplementVoid = {
      supplementId: 'extra-a',
      reason: 'Cambio solicitado',
      voidedAt: '2026-10-18T11:00:00.000Z',
    };
    const voidedProject = {
      ...project(),
      completedConcepts: 1,
      completedAmount: 50,
      percent: 50,
      status: 'in_progress' as const,
    };
    mocks.api.voidSupplement.mockResolvedValueOnce({
      project: voidedProject,
      supplementVoid,
      workItem: { ...supplementWorkItem, voidedAt: supplementVoid.voidedAt },
    });

    await useProjectStore.getState().voidSupplement('project-a', 'extra-a', 'Cambio solicitado');

    expect(useProjectStore.getState().activeProject).toMatchObject({
      supplementVoids: [{ supplementId: 'extra-a', reason: 'Cambio solicitado' }],
      workItems: [{ id: 'work-a' }, { id: 'supplement_extra-a', voidedAt: expect.any(String) }],
    });
    expect(useProjectStore.getState().projects[0]).toMatchObject({
      updatedTotal: 110,
      status: 'in_progress',
    });
  });

  it('discards a project-list response from an older session', async () => {
    let resolve: ((value: Project[]) => void) | undefined;
    mocks.api.fetchProjects.mockReturnValueOnce(
      new Promise<Project[]>((done) => {
        resolve = done;
      }),
    );
    useProjectStore.setState({ projects: [], activeProject: null, loaded: false });

    const pending = useProjectStore.getState().loadProjects('alice');
    setSessionUid('bob');
    resolve?.([project()]);
    await pending;

    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useProjectStore.getState().loaded).toBe(false);
  });

  it('adds and removes assignment snapshots without changing project economics', async () => {
    const assignment: ProjectAssignment = {
      id: 'crew_crew-a',
      resourceType: 'crew',
      resourceId: 'crew-a',
      label: 'Alba',
      color: 'green',
      members: [{ id: 'member-a', name: 'Ana Pérez' }],
      assignedAt: '2026-11-05T10:00:00.000Z',
    };
    mocks.api.addAssignment.mockResolvedValueOnce(assignment);
    mocks.api.removeAssignment.mockResolvedValueOnce(undefined);

    await useProjectStore.getState().addAssignment('project-a', 'crew', 'crew-a');
    expect(useProjectStore.getState().activeProject?.assignments).toEqual([assignment]);
    expect(useProjectStore.getState().projects[0]).toMatchObject({
      total: 110,
      updatedTotal: 110,
      completedConcepts: 0,
    });
    expect(mocks.api.addAssignment).toHaveBeenCalledWith('alice', 'project-a', 'crew', 'crew-a');

    await useProjectStore.getState().removeAssignment('project-a', assignment.id);
    expect(useProjectStore.getState().activeProject?.assignments).toEqual([]);
    expect(mocks.api.removeAssignment).toHaveBeenCalledWith('alice', 'project-a', assignment.id);
  });

  it('loads, saves, and resets date-specific team schedules through the session-aware API', async () => {
    const schedule = {
      assignmentsByProjectId: { 'project-a': [] },
      overridesByProjectDate: {},
    };
    const override = {
      projectId: 'project-a',
      date: '2026-11-09',
      assignments: [],
      updatedAt: '2026-11-06T10:00:00.000Z',
    };
    mocks.api.fetchTeamSchedule.mockResolvedValueOnce(schedule);
    mocks.api.saveDailyAssignments.mockResolvedValueOnce(override);
    mocks.api.removeDailyAssignmentOverride.mockResolvedValueOnce(undefined);

    await expect(
      useProjectStore.getState().loadTeamSchedule('alice', ['project-a'], ['2026-11-09']),
    ).resolves.toEqual(schedule);
    await expect(
      useProjectStore.getState().saveDailyAssignments('project-a', '2026-11-09', []),
    ).resolves.toEqual(override);
    await expect(
      useProjectStore.getState().removeDailyAssignmentOverride('project-a', '2026-11-09'),
    ).resolves.toBeUndefined();
    expect(mocks.api.fetchTeamSchedule).toHaveBeenCalledWith(
      'alice',
      ['project-a'],
      ['2026-11-09'],
    );
    expect(mocks.api.saveDailyAssignments).toHaveBeenCalledWith(
      'alice',
      'project-a',
      '2026-11-09',
      [],
    );
    expect(mocks.api.removeDailyAssignmentOverride).toHaveBeenCalledWith(
      'alice',
      'project-a',
      '2026-11-09',
    );
  });

  it('discards team schedule responses from an older session', async () => {
    let resolve: ((value: ProjectTeamScheduleData) => void) | null = null;
    mocks.api.fetchTeamSchedule.mockReturnValueOnce(
      new Promise<ProjectTeamScheduleData>((done) => {
        resolve = done;
      }),
    );

    const pending = useProjectStore
      .getState()
      .loadTeamSchedule('alice', ['project-a'], ['2026-11-09']);
    setSessionUid('bob');
    resolve?.({ assignmentsByProjectId: {}, overridesByProjectDate: {} });

    await expect(pending).resolves.toBeNull();
  });

  it('propagates project detail load errors so the page can offer retry', async () => {
    mocks.api.fetchProject.mockRejectedValueOnce(new Error('Firestore no disponible.'));

    await expect(useProjectStore.getState().loadProject('alice', 'project-a')).rejects.toThrow(
      'Firestore no disponible.',
    );
  });
});

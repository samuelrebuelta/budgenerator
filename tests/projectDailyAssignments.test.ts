import { describe, expect, it } from 'vitest';
import type { ProjectAssignment } from '../src/entities/project/model/types';
import {
  filterDailyProjectAssignments,
  findDailyAssignmentConflicts,
  findDailyScheduleConflicts,
  getEffectiveDayAssignments,
  getWeekDateKeys,
} from '../src/entities/project/model/dailyAssignments';

const member = (id: string, name = id): ProjectAssignment => ({
  id: `member_${id}`,
  resourceType: 'member',
  resourceId: id,
  label: name,
  members: [{ id, name }],
  assignedAt: '2026-11-06T10:00:00.000Z',
});

describe('project daily assignments', () => {
  it('returns a local Monday-to-Sunday week across month and year boundaries', () => {
    expect(getWeekDateKeys(new Date(2027, 0, 1, 12))).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });

  it('uses the saved empty override instead of restoring project defaults', () => {
    const defaults = [member('ana', 'Ana')];
    const effective = getEffectiveDayAssignments(defaults, {
      date: '2026-11-06',
      projectId: 'project-1',
      assignments: [],
      updatedAt: '2026-11-06T10:00:00.000Z',
    });

    expect(effective).toEqual([]);
    expect(getEffectiveDayAssignments(defaults)).toEqual(defaults);
  });

  it('reports a person inside a crew scheduled at two projects on the same day', () => {
    const crew: ProjectAssignment = {
      id: 'crew_crew-1',
      resourceType: 'crew',
      resourceId: 'crew-1',
      label: 'Albañilería',
      color: 'green',
      members: [
        { id: 'ana', name: 'Ana' },
        { id: 'hugo', name: 'Hugo' },
      ],
      assignedAt: '2026-11-06T10:00:00.000Z',
    };

    expect(
      findDailyAssignmentConflicts([
        { projectId: 'project-1', projectTitle: 'Cocina', assignments: [crew] },
        { projectId: 'project-2', projectTitle: 'Baño', assignments: [member('ana', 'Ana')] },
      ]),
    ).toEqual([
      {
        memberId: 'ana',
        memberName: 'Ana',
        projects: [
          { projectId: 'project-1', projectTitle: 'Cocina' },
          { projectId: 'project-2', projectTitle: 'Baño' },
        ],
      },
    ]);
  });

  it('does not report the same person twice inside one project as a project conflict', () => {
    const crew: ProjectAssignment = {
      id: 'crew_crew-1',
      resourceType: 'crew',
      resourceId: 'crew-1',
      label: 'Albañilería',
      color: 'green',
      members: [{ id: 'ana', name: 'Ana' }],
      assignedAt: '2026-11-06T10:00:00.000Z',
    };

    expect(
      findDailyAssignmentConflicts([
        {
          projectId: 'project-1',
          projectTitle: 'Cocina',
          assignments: [crew, member('ana', 'Ana')],
        },
      ]),
    ).toEqual([]);
  });

  it('reports a person assigned to both a project and an independent job on the same day', () => {
    const crew: ProjectAssignment = {
      id: 'crew_crew-1',
      resourceType: 'crew',
      resourceId: 'crew-1',
      label: 'Cuadrilla Norte',
      color: 'blue',
      members: [{ id: 'ana', name: 'Ana' }],
      assignedAt: '2026-11-06T10:00:00.000Z',
    };

    expect(
      findDailyScheduleConflicts([
        { id: 'project:p1', title: 'Cocina', assignments: [crew] },
        { id: 'job:j1', title: 'Remate de cocina', assignments: [member('ana', 'Ana')] },
      ]),
    ).toEqual([
      {
        memberId: 'ana',
        memberName: 'Ana',
        items: [
          { id: 'project:p1', title: 'Cocina' },
          { id: 'job:j1', title: 'Remate de cocina' },
        ],
      },
    ]);
  });

  it('does not report duplicate people inside the same schedule card', () => {
    const crew: ProjectAssignment = {
      id: 'crew_crew-1',
      resourceType: 'crew',
      resourceId: 'crew-1',
      label: 'Cuadrilla Norte',
      color: 'blue',
      members: [{ id: 'ana', name: 'Ana' }],
      assignedAt: '2026-11-06T10:00:00.000Z',
    };

    expect(
      findDailyScheduleConflicts([
        { id: 'job:j1', title: 'Remate de cocina', assignments: [crew, member('ana', 'Ana')] },
      ]),
    ).toEqual([]);
  });

  it('filters assignments by selected members and crews, including members inside crew snapshots', () => {
    const ana = member('ana', 'Ana');
    const luis = member('luis', 'Luis');
    const crew: ProjectAssignment = {
      id: 'crew_crew-1',
      resourceType: 'crew',
      resourceId: 'crew-1',
      label: 'Cuadrilla Norte',
      color: 'blue',
      members: [
        { id: 'ana', name: 'Ana' },
        { id: 'luis', name: 'Luis' },
      ],
      assignedAt: '2026-11-06T10:00:00.000Z',
    };
    const assignments = [ana, luis, crew];

    expect(filterDailyProjectAssignments(assignments, [])).toEqual(assignments);
    expect(filterDailyProjectAssignments(assignments, [{ type: 'member', id: 'ana' }])).toEqual([
      ana,
      { ...crew, members: [{ id: 'ana', name: 'Ana' }] },
    ]);
    expect(
      filterDailyProjectAssignments(assignments, [
        { type: 'member', id: 'ana' },
        { type: 'crew', id: 'crew-1' },
      ]),
    ).toEqual([ana, crew]);
  });
});

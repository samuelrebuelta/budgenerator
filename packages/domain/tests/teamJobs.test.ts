import { describe, expect, it } from 'vitest';
import type { TeamJob, TeamJobAssignment } from '../src/workforce/types';
import {
  buildTeamJobAssignment,
  filterTeamJobsByResources,
  validateTeamJobDraft,
} from '../src/workforce/teamJobs';
import type { WorkCrew, WorkforceMember } from '../src/workforce/types';

const ana: WorkforceMember = {
  id: 'member-ana',
  name: 'Ana Pérez',
  status: 'active',
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
};

const luis: WorkforceMember = {
  ...ana,
  id: 'member-luis',
  name: 'Luis Soto',
};

const inactive: WorkforceMember = {
  ...ana,
  id: 'member-inactive',
  name: 'Persona inactiva',
  status: 'inactive',
};

const crew: WorkCrew = {
  id: 'crew-1',
  label: 'Cuadrilla Alba',
  color: 'green',
  memberIds: [ana.id, luis.id],
  status: 'active',
  createdAt: ana.createdAt,
  updatedAt: ana.updatedAt,
};

const memberAssignment: TeamJobAssignment = {
  id: `member_${ana.id}`,
  resourceType: 'member',
  resourceId: ana.id,
  label: ana.name,
  members: [{ id: ana.id, name: ana.name }],
  assignedAt: ana.updatedAt,
};

const crewAssignment: TeamJobAssignment = {
  id: `crew_${crew.id}`,
  resourceType: 'crew',
  resourceId: crew.id,
  label: crew.label,
  color: crew.color,
  members: [
    { id: ana.id, name: ana.name },
    { id: luis.id, name: luis.name },
  ],
  assignedAt: ana.updatedAt,
};

const standaloneDraft = {
  date: '2026-11-07',
  title: 'Remate de cocina',
  description: 'Ajustar el frente del mueble y repasar la silicona.',
  assignments: [memberAssignment],
};

const job = (overrides: Partial<TeamJob> = {}): TeamJob => ({
  ...standaloneDraft,
  id: 'job-1',
  createdAt: ana.createdAt,
  updatedAt: ana.updatedAt,
  ...overrides,
});

describe('team jobs', () => {
  it('accepts a standalone job with a local date, title, description and an assignment', () => {
    expect(validateTeamJobDraft(standaloneDraft)).toEqual(standaloneDraft);
  });

  it('accepts a completed project link without a time limit and allows an empty description', () => {
    const draft = {
      date: '2032-08-19',
      title: 'Casa del Mar',
      description: '',
      assignments: [crewAssignment],
      projectId: 'project-completed-years-ago',
      projectTitle: 'Casa del Mar',
    };

    expect(validateTeamJobDraft(draft)).toEqual(draft);
  });

  it('requires a title but allows an empty description when no project is linked', () => {
    expect(() => validateTeamJobDraft({ ...standaloneDraft, title: ' ' })).toThrow(/título/i);
    expect(validateTeamJobDraft({ ...standaloneDraft, description: '  ' })).toMatchObject({
      title: standaloneDraft.title,
      description: '',
    });
  });

  it('requires at least one team resource', () => {
    expect(() => validateTeamJobDraft({ ...standaloneDraft, assignments: [] })).toThrow(
      /persona o cuadrilla/i,
    );
  });

  it('rejects impossible dates, invalid project links and oversized text', () => {
    expect(() => validateTeamJobDraft({ ...standaloneDraft, date: '2026-02-29' })).toThrow(
      /fecha/i,
    );
    expect(() => validateTeamJobDraft({ ...standaloneDraft, projectId: 'project-1' })).toThrow(
      /proyecto/i,
    );
    expect(() =>
      validateTeamJobDraft({ ...standaloneDraft, description: 'x'.repeat(2001) }),
    ).toThrow(/descripción/i);
  });

  it('creates snapshots for active members and active crews only', () => {
    expect(
      buildTeamJobAssignment({ type: 'member', resource: ana, members: [ana] }, ana.updatedAt),
    ).toEqual(memberAssignment);
    expect(
      buildTeamJobAssignment({ type: 'crew', resource: crew, members: [ana, luis] }, ana.updatedAt),
    ).toEqual(crewAssignment);
    expect(() =>
      buildTeamJobAssignment(
        { type: 'member', resource: inactive, members: [inactive] },
        ana.updatedAt,
      ),
    ).toThrow(/activa/i);
  });

  it('prevents assigning a crew member both individually and through the crew', () => {
    expect(() =>
      validateTeamJobDraft({ ...standaloneDraft, assignments: [memberAssignment, crewAssignment] }),
    ).toThrow(/duplicad/i);
  });

  it('filters jobs by selected members and crews and trims a crew snapshot to a member match', () => {
    const jobs = [
      job({ assignments: [memberAssignment] }),
      job({ id: 'job-crew', title: 'Revisión de baño', assignments: [crewAssignment] }),
    ];

    expect(filterTeamJobsByResources(jobs, [{ type: 'member', id: luis.id }])).toEqual([
      {
        ...jobs[1]!,
        assignments: [{ ...crewAssignment, members: [{ id: luis.id, name: luis.name }] }],
      },
    ]);
    expect(filterTeamJobsByResources(jobs, [{ type: 'crew', id: crew.id }])).toEqual([jobs[1]]);
    expect(filterTeamJobsByResources(jobs, [])).toEqual(jobs);
  });
});

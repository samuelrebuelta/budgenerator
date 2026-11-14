import { describe, expect, it, vi } from 'vitest';
import type { Project, ProjectAssignment } from '../src/entities/project';
import type { TeamJob } from '../src/entities/workforce';
import {
  buildWeekSchedule,
  formatWeekRange,
  scheduledItemCount,
  toggleResource,
  weekdayIndex,
} from '../src/pages/workforce/model/schedule';
import { swipeCommitThreshold } from '../src/pages/workforce/model/useWeekSwipe';
import { dateFromKey } from '../src/shared/lib/dateKey';

vi.mock('../src/shared/firebase/config', () => ({ db: {}, auth: {}, functions: {} }));

const week = [
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
  '2026-11-15',
];

const project = (id: string, extra: Partial<Project> = {}) =>
  ({ id, title: id, status: 'in_progress', estimatedEndDate: '2026-11-11', ...extra }) as Project;

const ana: ProjectAssignment = {
  id: 'member:ana',
  resourceType: 'member',
  resourceId: 'ana',
  label: 'Ana',
  members: [{ id: 'ana', name: 'Ana' }],
  assignedAt: '2026-11-01T10:00:00Z',
};

const job = {
  id: 'job-1',
  title: 'Caldera',
  description: '',
  date: '2026-11-12',
  assignments: [ana],
  createdAt: '',
  updatedAt: '',
} as TeamJob;

describe('team schedule model', () => {
  it('formats week ranges within and across months and years', () => {
    expect(formatWeekRange(week)).toEqual({ range: '9–15 nov', year: '2026' });
    expect(
      formatWeekRange([
        '2026-12-28',
        '2026-12-29',
        '2026-12-30',
        '2026-12-31',
        '2027-01-01',
        '2027-01-02',
        '2027-01-03',
      ]),
    ).toEqual({ range: '28 dic–3 ene', year: '2026–2027' });
  });

  it('uses Monday as the first weekday', () => {
    expect(weekdayIndex(dateFromKey('2026-11-09'))).toBe(0);
    expect(weekdayIndex(dateFromKey('2026-11-15'))).toBe(6);
  });

  it('shows projects until their estimated end date and jobs on their day', () => {
    const data = buildWeekSchedule(week, {
      projects: [project('reforma'), project('cerrada', { status: 'completed' })],
      assignmentsByProjectId: { reforma: [ana] },
      overridesByProjectDate: {},
      teamJobs: [job],
      selectedResources: [],
    });
    expect(data.rowsByDate['2026-11-11']!.map((row) => row.project.id)).toEqual(['reforma']);
    expect(data.rowsByDate['2026-11-12']).toEqual([]);
    expect(data.jobsByDate['2026-11-12']).toEqual([job]);
    expect(scheduledItemCount('2026-11-09', data)).toBe(1);
    expect(scheduledItemCount('2026-11-12', data)).toBe(1);
  });

  it('filters by resource and toggles selections', () => {
    const selected = toggleResource([], { type: 'member', id: 'luis' });
    const data = buildWeekSchedule(week, {
      projects: [project('reforma')],
      assignmentsByProjectId: { reforma: [ana] },
      overridesByProjectDate: {},
      teamJobs: [job],
      selectedResources: selected,
    });
    expect(data.rowsByDate['2026-11-09']).toEqual([]);
    expect(data.jobsByDate['2026-11-12']).toEqual([]);
    expect(toggleResource(selected, { type: 'member', id: 'luis' })).toEqual([]);
  });

  it('commits a swipe after 22 % of the width, between 56 and 120 px', () => {
    expect(swipeCommitThreshold(200)).toBe(56);
    expect(swipeCommitThreshold(400)).toBeCloseTo(88);
    expect(swipeCommitThreshold(1200)).toBe(120);
  });
});

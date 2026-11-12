import {
  filterDailyProjectAssignments,
  findDailyScheduleConflicts,
  getEffectiveDayAssignments,
  isOnOrBeforeEstimatedEndDate,
} from '@/entities/project';
import type {
  DailyAssignmentResourceFilter,
  Project,
  ProjectAssignment,
  ProjectDailyAssignmentOverride,
} from '@/entities/project';
import { filterTeamJobsByResources, type TeamJob } from '@/entities/workforce';
import { APP_LOCALE, dateFromKey, type DateKey } from '@/shared/lib';

export interface DayScheduleRow {
  project: Project;
  override?: ProjectDailyAssignmentOverride;
  assignments: ProjectAssignment[];
}
export type DayScheduleRowsByDate = Record<DateKey, DayScheduleRow[]>;
export type TeamJobsByDate = Record<DateKey, TeamJob[]>;

export interface WeekScheduleData {
  rowsByDate: DayScheduleRowsByDate;
  jobsByDate: TeamJobsByDate;
}

export interface ScheduleSource {
  projects: Project[];
  assignmentsByProjectId: Record<string, ProjectAssignment[]>;
  overridesByProjectDate: Record<string, ProjectDailyAssignmentOverride>;
  teamJobs: TeamJob[];
  selectedResources: DailyAssignmentResourceFilter[];
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

const shortMonth = (date: Date) =>
  new Intl.DateTimeFormat(APP_LOCALE, { month: 'short' }).format(date).replace('.', '');

/** «9–15 nov» + «2026», or «28 dic–3 ene» + «2026–2027». */
export function formatWeekRange(dateKeys: DateKey[]): { range: string; year: string } {
  const start = dateFromKey(dateKeys[0]!);
  const end = dateFromKey(dateKeys[dateKeys.length - 1]!);
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const range = sameMonth
    ? `${start.getDate()}–${end.getDate()} ${shortMonth(end)}`
    : `${start.getDate()} ${shortMonth(start)}–${end.getDate()} ${shortMonth(end)}`;
  const year =
    start.getFullYear() === end.getFullYear()
      ? String(end.getFullYear())
      : `${start.getFullYear()}–${end.getFullYear()}`;
  return { range, year };
}

export function formatDayLabel(dateKey: DateKey, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(APP_LOCALE, options).format(dateFromKey(dateKey));
}

/** «lunes, 9 de noviembre». */
export function formatLongDay(dateKey: DateKey, withYear = false): string {
  return formatDayLabel(dateKey, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** «lun». */
export function formatShortWeekday(dateKey: DateKey): string {
  return formatDayLabel(dateKey, { weekday: 'short' }).replace('.', '');
}

/** Projects shown in a week: active ones, plus completed ones with a plan on one of its days. */
export function visibleProjectsForWeek(
  projects: Project[],
  dateKeys: DateKey[],
  overridesByProjectDate: Record<string, ProjectDailyAssignmentOverride>,
): Project[] {
  return projects
    .filter(
      (project) =>
        project.status !== 'completed' ||
        dateKeys.some((dateKey) => overridesByProjectDate[`${project.id}:${dateKey}`]),
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'es'));
}

/** Rows of one day: projects until their estimated end with their effective, filtered team. */
export function dayAssignments(
  dateKey: DateKey,
  projects: Project[],
  assignmentsByProjectId: Record<string, ProjectAssignment[]>,
  overridesByProjectDate: Record<string, ProjectDailyAssignmentOverride>,
  selectedResources: DailyAssignmentResourceFilter[],
): DayScheduleRow[] {
  const rows = projects
    .filter(
      (project) =>
        isOnOrBeforeEstimatedEndDate(dateKey, project.estimatedEndDate) &&
        (project.status !== 'completed' ||
          Boolean(overridesByProjectDate[`${project.id}:${dateKey}`])),
    )
    .map((project) => {
      const override = overridesByProjectDate[`${project.id}:${dateKey}`];
      return {
        project,
        override,
        assignments: getEffectiveDayAssignments(
          project.status === 'completed' ? [] : (assignmentsByProjectId[project.id] ?? []),
          override,
        ),
      };
    });
  if (selectedResources.length === 0) return rows;
  return rows
    .map((row) => ({
      ...row,
      assignments: filterDailyProjectAssignments(row.assignments, selectedResources),
    }))
    .filter((row) => row.assignments.length > 0);
}

/** Rows and one-off jobs per day of a week, with the resource filter applied. */
export function buildWeekSchedule(dateKeys: DateKey[], source: ScheduleSource): WeekScheduleData {
  const projects = visibleProjectsForWeek(source.projects, dateKeys, source.overridesByProjectDate);
  const jobs = filterTeamJobsByResources(source.teamJobs, source.selectedResources);
  return {
    rowsByDate: Object.fromEntries(
      dateKeys.map((dateKey) => [
        dateKey,
        dayAssignments(
          dateKey,
          projects,
          source.assignmentsByProjectId,
          source.overridesByProjectDate,
          source.selectedResources,
        ),
      ]),
    ),
    jobsByDate: Object.fromEntries(
      dateKeys.map((dateKey) => [dateKey, jobs.filter((job) => job.date === dateKey)]),
    ),
  };
}

/** Number of staffed projects plus one-off jobs on a day (dots in the day strip). */
export function scheduledItemCount(dateKey: DateKey, week: WeekScheduleData): number {
  const rows = week.rowsByDate[dateKey] ?? [];
  return (
    rows.filter((row) => row.assignments.length > 0).length +
    (week.jobsByDate[dateKey]?.length ?? 0)
  );
}

/** People booked twice on the same day, across projects and one-off jobs. */
export function dayConflicts(rows: DayScheduleRow[], jobs: TeamJob[]) {
  return findDailyScheduleConflicts([
    ...rows.map(({ project, assignments }) => ({
      id: `project:${project.id}`,
      title: project.title,
      assignments,
    })),
    ...jobs.map((job) => ({ id: `job:${job.id}`, title: job.title, assignments: job.assignments })),
  ]);
}

export function isResourceSelected(
  selected: DailyAssignmentResourceFilter[],
  resource: DailyAssignmentResourceFilter,
): boolean {
  return selected.some((item) => item.type === resource.type && item.id === resource.id);
}

export function toggleResource(
  selected: DailyAssignmentResourceFilter[],
  resource: DailyAssignmentResourceFilter,
): DailyAssignmentResourceFilter[] {
  return isResourceSelected(selected, resource)
    ? selected.filter((item) => item.type !== resource.type || item.id !== resource.id)
    : [...selected, resource];
}

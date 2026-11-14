import { dateFromKey, money, toDateKey } from '@bg/domain';
import { getProjectLocalDateKey } from '@bg/domain/project/history';
import type { Project, ProjectDetail, ProjectStatus } from '@bg/domain/project/types';

/** Labels of the web's `ProjectStatusTag`. */
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completado',
};

export type ProjectStatusFilter = ProjectStatus | '';

export const STATUS_FILTERS: { value: ProjectStatusFilter; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'in_progress', label: STATUS_LABELS.in_progress },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'completed', label: STATUS_LABELS.completed },
];

/** Title shown for a project, as the web (`title` or «Presupuesto N»). */
export function projectTitle(project: Pick<Project, 'title' | 'sourceBudgetNumber'>) {
  return project.title || `Presupuesto ${project.sourceBudgetNumber}`;
}

/** Second line of the web list and detail: title (or address when it differs). */
export function projectSubtitle(project: Project) {
  const title = projectTitle(project);
  return project.address && project.address !== project.title
    ? `${title} · ${project.address}`
    : title;
}

function searchableText(project: Project) {
  return [project.clientName, project.title, project.address, project.sourceBudgetNumber]
    .join(' ')
    .toLocaleLowerCase('es');
}

/**
 * Search and status filter of the projects list. The web list has neither (it shows every project
 * in the store order); the app adds them as on the budgets list (registro BG-014, paso 9).
 */
export function filterProjects(
  projects: readonly Project[],
  search: string,
  status: ProjectStatusFilter,
) {
  const query = search.trim().toLocaleLowerCase('es');
  return projects.filter(
    (project) =>
      (!status || project.status === status) && (!query || searchableText(project).includes(query)),
  );
}

/** «14 de noviembre de 2026» for an ISO timestamp or a `YYYY-MM-DD` key (web `dateLabel`). */
export function formatProjectDate(value: string) {
  try {
    return dateFromKey(getProjectLocalDateKey(value)).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return 'Sin fecha';
  }
}

/** «14 nov» for the completion chips (web `compactDateLabel`). */
export function formatCompactDate(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

/** Active supplements with VAT (the detail's «Suplementos activos»), rounded by `@bg/domain`. */
export function activeSupplementsTotal(project: Project) {
  return money((project.supplementsSubtotal ?? 0) + (project.supplementsIva ?? 0));
}

/** Concepts of the non-voided work items (the history table's «de N»). */
export function activeConceptCount(project: Pick<ProjectDetail, 'workItems'>) {
  return project.workItems
    .filter((item) => !item.voidedAt)
    .reduce((count, item) => count + item.tasks.length, 0);
}

export const todayDateKey = () => toDateKey(new Date());

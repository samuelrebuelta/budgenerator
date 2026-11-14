import { toDateKey } from '../lib/dateKey.js';
import type { ProjectAssignment, ProjectDailyAssignmentOverride } from './types';
export { isOnOrBeforeEstimatedEndDate, normalizeEstimatedEndDate } from './estimatedEndDate';

export interface DailyAssignmentResourceFilter {
  type: 'member' | 'crew';
  id: string;
}

export interface DailyProjectAssignments {
  projectId: string;
  projectTitle: string;
  assignments: ProjectAssignment[];
}

export interface DailyAssignmentConflict {
  memberId: string;
  memberName: string;
  projects: { projectId: string; projectTitle: string }[];
}

export interface DailyScheduleItem {
  id: string;
  title: string;
  assignments: ProjectAssignment[];
}

export interface DailyScheduleConflict {
  memberId: string;
  memberName: string;
  items: { id: string; title: string }[];
}

export function getWeekDateKeys(anchorDate: Date): string[] {
  if (!Number.isFinite(anchorDate.getTime()))
    throw new Error('La semana seleccionada no es válida.');
  const monday = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    return toDateKey(date);
  });
}

export function getEffectiveDayAssignments(
  defaults: ProjectAssignment[],
  override?: ProjectDailyAssignmentOverride,
): ProjectAssignment[] {
  return override ? override.assignments : defaults;
}

export function filterDailyProjectAssignments(
  assignments: ProjectAssignment[],
  selectedResources: DailyAssignmentResourceFilter[],
): ProjectAssignment[] {
  if (selectedResources.length === 0) return assignments;

  const selectedMemberIds = new Set(
    selectedResources
      .filter((resource) => resource.type === 'member')
      .map((resource) => resource.id),
  );
  const selectedCrewIds = new Set(
    selectedResources.filter((resource) => resource.type === 'crew').map((resource) => resource.id),
  );

  return assignments.flatMap((assignment) => {
    if (assignment.resourceType === 'member') {
      return selectedMemberIds.has(assignment.resourceId) ? [assignment] : [];
    }
    if (selectedCrewIds.has(assignment.resourceId)) return [assignment];

    const matchingMembers = assignment.members.filter((member) => selectedMemberIds.has(member.id));
    return matchingMembers.length > 0 ? [{ ...assignment, members: matchingMembers }] : [];
  });
}

export function findDailyAssignmentConflicts(
  projects: DailyProjectAssignments[],
): DailyAssignmentConflict[] {
  const byMember = new Map<
    string,
    { memberName: string; projects: Map<string, { projectId: string; projectTitle: string }> }
  >();

  for (const project of projects) {
    const membersInProject = new Set<string>();
    for (const assignment of project.assignments) {
      for (const member of assignment.members) {
        if (membersInProject.has(member.id)) continue;
        membersInProject.add(member.id);
        const current = byMember.get(member.id) ?? {
          memberName: member.name,
          projects: new Map(),
        };
        current.projects.set(project.projectId, {
          projectId: project.projectId,
          projectTitle: project.projectTitle,
        });
        byMember.set(member.id, current);
      }
    }
  }

  return [...byMember.entries()]
    .filter(([, value]) => value.projects.size > 1)
    .map(([memberId, value]) => ({
      memberId,
      memberName: value.memberName,
      projects: [...value.projects.values()],
    }));
}

export function findDailyScheduleConflicts(items: DailyScheduleItem[]): DailyScheduleConflict[] {
  const byMember = new Map<
    string,
    { memberName: string; items: Map<string, { id: string; title: string }> }
  >();

  for (const item of items) {
    const membersInItem = new Set<string>();
    for (const assignment of item.assignments) {
      for (const member of assignment.members) {
        if (membersInItem.has(member.id)) continue;
        membersInItem.add(member.id);
        const current = byMember.get(member.id) ?? { memberName: member.name, items: new Map() };
        current.items.set(item.id, { id: item.id, title: item.title });
        byMember.set(member.id, current);
      }
    }
  }

  return [...byMember.entries()]
    .filter(([, value]) => value.items.size > 1)
    .map(([memberId, value]) => ({
      memberId,
      memberName: value.memberName,
      items: [...value.items.values()],
    }));
}

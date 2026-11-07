import type { CrewColor } from '@/shared/types';
import type { TeamJobAssignment, TeamJobDraft, WorkCrew, WorkforceMember } from './types';

const MAX_TEAM_JOB_BYTES = 900_000;
const MAX_TEAM_JOB_ASSIGNMENTS = 499;
const MAX_TEAM_JOB_MEMBERS = 500;
const MAX_TEAM_JOB_TITLE_LENGTH = 120;
const MAX_TEAM_JOB_DESCRIPTION_LENGTH = 2_000;
const CREW_COLORS: CrewColor[] = ['blue', 'green', 'amber', 'rose', 'violet', 'cyan', 'slate'];

function assertResourceId(id: string) {
  if (!id || id.length > 128 || id.includes('/'))
    throw new Error('El recurso no tiene un ID válido.');
}

function isRealDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!, 12);
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day;
}

function assertAssignmentSize(assignment: TeamJobAssignment) {
  if (!assignment.id || assignment.id.length > 140)
    throw new Error('La asignación del trabajo no tiene un ID válido.');
  assertResourceId(assignment.resourceId);
  if (assignment.id !== `${assignment.resourceType}_${assignment.resourceId}`)
    throw new Error('El ID de la asignación no coincide con el recurso.');
  if (!assignment.label.trim() || assignment.label.length > 100)
    throw new Error('La etiqueta del recurso no es válida.');
  if (!assignment.assignedAt || assignment.assignedAt.length > 40)
    throw new Error('La fecha de asignación no es válida.');
  if (assignment.members.length === 0 || assignment.members.length > MAX_TEAM_JOB_MEMBERS)
    throw new Error('La asignación no contiene integrantes válidos.');

  const memberIds = new Set<string>();
  for (const member of assignment.members) {
    assertResourceId(member.id);
    if (!member.name.trim() || member.name.length > 100 || memberIds.has(member.id))
      throw new Error('La lista de integrantes de la asignación no es válida.');
    memberIds.add(member.id);
  }

  if (assignment.resourceType === 'member') {
    if (assignment.members.length !== 1 || assignment.members[0]!.id !== assignment.resourceId)
      throw new Error('La asignación individual no coincide con la persona.');
    if (assignment.color !== undefined)
      throw new Error('Una asignación individual no puede tener color de cuadrilla.');
  } else if (!assignment.color || !CREW_COLORS.includes(assignment.color)) {
    throw new Error('El color de la cuadrilla no es válido.');
  }
}

export function validateTeamJobDraft(input: TeamJobDraft): TeamJobDraft {
  const title = input.title.trim();
  const description = input.description.trim();
  const date = input.date.trim();
  const projectId = input.projectId?.trim() || undefined;
  const projectTitle = input.projectTitle?.trim() || undefined;

  if (!title || title.length > MAX_TEAM_JOB_TITLE_LENGTH)
    throw new Error('El título debe tener entre 1 y 120 caracteres.');
  if (description.length > MAX_TEAM_JOB_DESCRIPTION_LENGTH)
    throw new Error('La descripción no puede superar 2.000 caracteres.');
  if (!isRealDateKey(date)) throw new Error('La fecha del trabajo no es válida.');
  if (projectId && (!projectTitle || projectTitle.length > MAX_TEAM_JOB_TITLE_LENGTH))
    throw new Error('El proyecto enlazado no es válido.');
  if (!projectId && projectTitle)
    throw new Error('No se puede guardar el título de un proyecto sin enlazarlo.');
  if (!input.assignments.length || input.assignments.length > MAX_TEAM_JOB_ASSIGNMENTS)
    throw new Error('Asigna al menos una persona o cuadrilla al trabajo.');

  const assignmentIds = new Set<string>();
  const assignedMembers = new Set<string>();
  for (const assignment of input.assignments) {
    assertAssignmentSize(assignment);
    if (assignmentIds.has(assignment.id))
      throw new Error('No puedes duplicar una asignación del mismo recurso.');
    assignmentIds.add(assignment.id);
    for (const member of assignment.members) {
      if (assignedMembers.has(member.id))
        throw new Error('No puedes asignar a una persona duplicada en el trabajo.');
      assignedMembers.add(member.id);
    }
  }

  const draft = {
    title,
    description,
    date,
    assignments: input.assignments,
    ...(projectId ? { projectId, projectTitle } : {}),
  } satisfies TeamJobDraft;
  if (new TextEncoder().encode(JSON.stringify(draft)).length >= MAX_TEAM_JOB_BYTES)
    throw new Error('El trabajo supera el límite de 900.000 bytes.');
  return draft;
}

type TeamJobAssignmentInput =
  | { type: 'member'; resource: WorkforceMember; members?: WorkforceMember[] }
  | { type: 'crew'; resource: WorkCrew; members: WorkforceMember[] };

export function buildTeamJobAssignment(
  input: TeamJobAssignmentInput,
  assignedAt = new Date().toISOString(),
): TeamJobAssignment {
  assertResourceId(input.resource.id);
  if (!assignedAt || assignedAt.length > 40)
    throw new Error('La fecha de asignación no es válida.');

  if (input.type === 'member') {
    const { resource } = input;
    if (resource.status !== 'active') throw new Error('Solo se pueden asignar personas activas.');
    return {
      id: `member_${resource.id}`,
      resourceType: 'member',
      resourceId: resource.id,
      label: resource.name,
      members: [{ id: resource.id, name: resource.name }],
      assignedAt,
    };
  }

  const { resource } = input;
  if (resource.status !== 'active') throw new Error('Solo se pueden asignar cuadrillas activas.');
  const membersById = new Map(input.members.map((member) => [member.id, member]));
  const activeMembers = [...new Set(resource.memberIds)]
    .map((id) => membersById.get(id))
    .filter((member): member is WorkforceMember => Boolean(member && member.status === 'active'));
  if (!activeMembers.length)
    throw new Error('La cuadrilla no tiene integrantes activos y no se puede asignar.');

  return {
    id: `crew_${resource.id}`,
    resourceType: 'crew',
    resourceId: resource.id,
    label: resource.label,
    color: resource.color,
    members: activeMembers.map(({ id, name }) => ({ id, name })),
    assignedAt,
  };
}

export function filterTeamJobsByResources<T extends { assignments: TeamJobAssignment[] }>(
  jobs: T[],
  selectedResources: { type: 'member' | 'crew'; id: string }[],
): T[] {
  if (selectedResources.length === 0) return jobs;

  const selectedMemberIds = new Set(
    selectedResources
      .filter((resource) => resource.type === 'member')
      .map((resource) => resource.id),
  );
  const selectedCrewIds = new Set(
    selectedResources.filter((resource) => resource.type === 'crew').map((resource) => resource.id),
  );

  return jobs.flatMap((job) => {
    const assignments = job.assignments.flatMap((assignment) => {
      if (assignment.resourceType === 'member')
        return selectedMemberIds.has(assignment.resourceId) ? [assignment] : [];
      if (selectedCrewIds.has(assignment.resourceId)) return [assignment];
      const members = assignment.members.filter((member) => selectedMemberIds.has(member.id));
      return members.length ? [{ ...assignment, members }] : [];
    });
    return assignments.length ? [{ ...job, assignments }] : [];
  });
}

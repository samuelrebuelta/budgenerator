import type { CrewColor } from '@/shared/types';
import type { ProjectAssignment } from './types';

const MAX_ASSIGNMENT_BYTES = 900_000;

export interface AssignmentMemberSource {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface AssignmentCrewSource {
  id: string;
  label: string;
  color: CrewColor;
  memberIds: string[];
  status: 'active' | 'inactive';
}

type AssignmentInput =
  | { resourceType: 'member'; resource: AssignmentMemberSource }
  | { resourceType: 'crew'; resource: AssignmentCrewSource; members: AssignmentMemberSource[] };

function assertResourceId(id: string) {
  if (!id || id.length > 128 || id.includes('/'))
    throw new Error('El recurso no tiene un ID válido.');
}

function assertSize(assignment: ProjectAssignment) {
  const size = new TextEncoder().encode(JSON.stringify(assignment)).length;
  if (size >= MAX_ASSIGNMENT_BYTES)
    throw new Error('La asignación supera el límite de 900.000 bytes.');
}

export function buildProjectAssignment(
  input: AssignmentInput,
  assignedAt: string,
): ProjectAssignment {
  assertResourceId(input.resource.id);
  if (!assignedAt) throw new Error('La fecha de asignación no es válida.');

  if (input.resourceType === 'member') {
    const { resource } = input;
    if (resource.status !== 'active') throw new Error('Solo se pueden asignar personas activas.');
    const assignment: ProjectAssignment = {
      id: `member_${resource.id}`,
      resourceType: 'member',
      resourceId: resource.id,
      label: resource.name,
      members: [{ id: resource.id, name: resource.name }],
      assignedAt,
    };
    assertSize(assignment);
    return assignment;
  }

  const { resource, members } = input;
  if (resource.status !== 'active') throw new Error('Solo se pueden asignar cuadrillas activas.');
  const membersById = new Map(members.map((member) => [member.id, member]));
  const activeMembers = [...new Set(resource.memberIds)]
    .map((id) => {
      const member = membersById.get(id);
      if (!member) throw new Error('No se ha encontrado una persona de la cuadrilla.');
      return member;
    })
    .filter((member) => member.status === 'active');
  if (activeMembers.length === 0)
    throw new Error('La cuadrilla no tiene integrantes activos y no se puede asignar.');

  const assignment: ProjectAssignment = {
    id: `crew_${resource.id}`,
    resourceType: 'crew',
    resourceId: resource.id,
    label: resource.label,
    color: resource.color,
    members: activeMembers.map(({ id, name }) => ({ id, name })),
    assignedAt,
  };
  assertSize(assignment);
  return assignment;
}

export function findCrewAssignmentForMember(
  memberId: string,
  assignments: ProjectAssignment[],
): ProjectAssignment | undefined {
  return assignments.find(
    (assignment) =>
      assignment.resourceType === 'crew' &&
      assignment.members.some((member) => member.id === memberId),
  );
}

import {
  findAssignmentWithOverlappingMember,
  findCrewAssignmentForMember,
} from '@bg/domain/project/assignments';
import type { ProjectAssignment } from '@bg/domain/project/types';
import type { CrewColor } from '@bg/domain/types';
import type { WorkCrew, WorkforceMember } from '@bg/domain/workforce/types';
import { colors } from '@bg/ui-tokens';

/** Crew palette of the web (`colorFor`), from the `crew-*` tokens of `@bg/ui-tokens`. */
export function crewColor(color: CrewColor | undefined) {
  const value: CrewColor = color ?? 'blue';
  return {
    fill: colors[`crew-${value}-surface`],
    ink: colors[`crew-${value}-ink`],
    dot: colors[`crew-${value}`],
  };
}

/** Active members of a crew, without duplicates (web `activeCrewMembers`). */
export function activeCrewMembers(crew: WorkCrew, members: WorkforceMember[]) {
  const activeById = new Map(
    members.filter((member) => member.status === 'active').map((member) => [member.id, member]),
  );
  return [...new Set(crew.memberIds)]
    .map((id) => activeById.get(id))
    .filter((member): member is WorkforceMember => Boolean(member));
}

export interface MemberOption {
  member: WorkforceMember;
  assigned: boolean;
  /** Crew assignment that already includes the person: it cannot be assigned on its own. */
  inCrew?: ProjectAssignment;
}

export interface CrewOption {
  crew: WorkCrew;
  assigned: boolean;
  activeCount: number;
  /** Conflict text when the crew shares people with another assignment (web overlap rule). */
  conflict: string;
}

/**
 * Options of the «Asignar equipo» sheet with the same conflict rules as the web dialog and the
 * `addAssignment` transaction: a person included in an assigned crew, or a crew sharing people with
 * another assignment, cannot be assigned.
 */
export function assignmentOptions(
  members: WorkforceMember[],
  crews: WorkCrew[],
  assignments: ProjectAssignment[],
): { members: MemberOption[]; crews: CrewOption[] } {
  const memberOptions = members
    .filter((member) => member.status === 'active')
    .map((member) => ({
      member,
      assigned: assignments.some(
        (item) => item.resourceType === 'member' && item.resourceId === member.id,
      ),
      inCrew: findCrewAssignmentForMember(member.id, assignments),
    }));
  const crewOptions = crews
    .filter((crew) => crew.status === 'active' && activeCrewMembers(crew, members).length > 0)
    .map((crew) => {
      const crewMembers = activeCrewMembers(crew, members);
      const overlapping = findAssignmentWithOverlappingMember(
        crewMembers.map((member) => member.id),
        assignments,
        `crew_${crew.id}`,
      );
      return {
        crew,
        assigned: assignments.some(
          (item) => item.resourceType === 'crew' && item.resourceId === crew.id,
        ),
        activeCount: crewMembers.length,
        conflict: overlapping
          ? overlapping.resourceType === 'member'
            ? `Incluye a ${overlapping.label}, ya asignada individualmente`
            : `Comparte integrantes con ${overlapping.label}, ya asignada`
          : '',
      };
    });
  return { members: memberOptions, crews: crewOptions };
}

/** Same checks and messages as the web form and `updateProjectMetadata` of `@bg/firebase-api`. */
export function validateProjectMetadata(title: string, clientName: string): string {
  const name = title.trim();
  if (!name || name.length > 120)
    return 'El nombre del proyecto debe tener entre 1 y 120 caracteres.';
  if (clientName.trim().length > 120)
    return 'El nombre del cliente no puede superar los 120 caracteres.';
  return '';
}

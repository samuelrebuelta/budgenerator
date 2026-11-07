import type { CrewColor } from '@/shared/types';
import type { CrewInput, ValidatedCrewInput, WorkforceMember } from './types';

const CREW_COLORS: CrewColor[] = ['blue', 'green', 'amber', 'rose', 'violet', 'cyan', 'slate'];

export function normalizeWorkforceName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validateMemberName(value: string): string {
  const name = normalizeWorkforceName(value);
  if (!name) throw new Error('Escribe el nombre de la persona.');
  if (name.length > 100) throw new Error('El nombre no puede superar los 100 caracteres.');
  return name;
}

export function validateCrewInput(
  input: CrewInput,
  members: WorkforceMember[],
  options: { requireActive?: boolean } = {},
): ValidatedCrewInput {
  const label = normalizeWorkforceName(input.label);
  if (!label) throw new Error('Escribe la etiqueta de la cuadrilla.');
  if (label.length > 60) throw new Error('La etiqueta no puede superar los 60 caracteres.');
  if (!CREW_COLORS.includes(input.color as CrewColor)) throw new Error('Elige un color válido.');
  if (!Array.isArray(input.memberIds) || input.memberIds.length === 0)
    throw new Error('Añade al menos una persona a la cuadrilla.');

  const memberIds = [...new Set(input.memberIds)];
  const membersById = new Map(members.map((member) => [member.id, member]));
  const selectedMembers = memberIds.map((id) => {
    const member = membersById.get(id);
    if (!member) throw new Error('La cuadrilla contiene una persona que ya no existe.');
    return member;
  });
  if (
    options.requireActive !== false &&
    !selectedMembers.some((member) => member.status === 'active')
  )
    throw new Error('La cuadrilla debe tener al menos una persona activa.');

  return { label, color: input.color as CrewColor, memberIds };
}

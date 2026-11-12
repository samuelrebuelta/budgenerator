import { useMemo, useState, type FormEvent } from 'react';
import type { Project, ProjectAssignment } from '@/entities/project';
import type { WorkCrew, WorkforceMember } from '@/entities/workforce';
import { Alert, Button, Modal } from '@/shared/ui';
import { colorFor } from '@/entities/workforce';
import { teamErrorMessage } from '../model/teamErrors';

interface DailyProjectAssignmentsDialogProps {
  project: Project;
  dateLabel: string;
  members: WorkforceMember[];
  crews: WorkCrew[];
  assignments: ProjectAssignment[];
  hasOverride: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (assignments: ProjectAssignment[]) => Promise<void>;
  onReset: () => Promise<void>;
}

function memberAssignment(member: WorkforceMember): ProjectAssignment {
  return {
    id: `member_${member.id}`,
    resourceType: 'member',
    resourceId: member.id,
    label: member.name,
    members: [{ id: member.id, name: member.name }],
    assignedAt: new Date().toISOString(),
  };
}

function crewAssignment(crew: WorkCrew, members: WorkforceMember[]): ProjectAssignment {
  return {
    id: `crew_${crew.id}`,
    resourceType: 'crew',
    resourceId: crew.id,
    label: crew.label,
    color: crew.color,
    members: members.map(({ id, name }) => ({ id, name })),
    assignedAt: new Date().toISOString(),
  };
}

export function DailyProjectAssignmentsDialog({
  project,
  dateLabel,
  members,
  crews,
  assignments,
  hasOverride,
  saving,
  onClose,
  onSave,
  onReset,
}: DailyProjectAssignmentsDialogProps) {
  const [draft, setDraft] = useState(assignments);
  const [error, setError] = useState('');

  const activeMembersById = useMemo(
    () =>
      new Map(
        members.filter((member) => member.status === 'active').map((member) => [member.id, member]),
      ),
    [members],
  );
  const assignedCrews = draft.filter((assignment) => assignment.resourceType === 'crew');
  const includedMemberIds = new Set(
    assignedCrews.flatMap((assignment) => assignment.members.map((member) => member.id)),
  );
  const availableMembers = members.filter((member) => !includedMemberIds.has(member.id));

  const toggleCrew = (crew: WorkCrew, selected: boolean) => {
    setDraft((current) => {
      if (!selected) return current.filter((assignment) => assignment.id !== `crew_${crew.id}`);
      const crewMembers = crew.memberIds
        .map((memberId) => activeMembersById.get(memberId))
        .filter((member): member is WorkforceMember => Boolean(member));
      if (!crewMembers.length) return current;
      const includedIds = new Set(crewMembers.map((member) => member.id));
      return [
        ...current.filter(
          (assignment) =>
            assignment.id !== `crew_${crew.id}` &&
            !(assignment.resourceType === 'member' && includedIds.has(assignment.resourceId)),
        ),
        crewAssignment(crew, crewMembers),
      ];
    });
  };

  const toggleCrewMember = (crewId: string, memberId: string, selected: boolean) => {
    const person = members.find((member) => member.id === memberId);
    if (!person) return;
    setDraft((current) =>
      current.flatMap((assignment) => {
        if (assignment.id !== `crew_${crewId}`) return [assignment];
        const crewMembers = selected
          ? [
              ...assignment.members.filter((member) => member.id !== memberId),
              { id: person.id, name: person.name },
            ]
          : assignment.members.filter((member) => member.id !== memberId);
        return crewMembers.length ? [{ ...assignment, members: crewMembers }] : [];
      }),
    );
  };

  const toggleMember = (member: WorkforceMember, selected: boolean) => {
    setDraft((current) => {
      if (!selected) return current.filter((assignment) => assignment.id !== `member_${member.id}`);
      if (
        current.some(
          (assignment) =>
            assignment.resourceType === 'crew' &&
            assignment.members.some((item) => item.id === member.id),
        )
      )
        return current;
      if (current.some((assignment) => assignment.id === `member_${member.id}`)) return current;
      return [...current, memberAssignment(member)];
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      await onSave(draft);
    } catch (saveError) {
      setError(
        teamErrorMessage(saveError, 'No se ha podido guardar la planificación de este día.'),
      );
    }
  };

  const reset = async () => {
    setError('');
    try {
      await onReset();
    } catch (resetError) {
      setError(
        teamErrorMessage(resetError, 'No se han podido restaurar las asignaciones del proyecto.'),
      );
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar equipo de ${project.title}`}
      panelClassName="max-w-xl"
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-ink-strong">{project.title}</h2>
          <p className="mt-1 text-sm text-ink-subtle">
            {dateLabel}. Este cambio solo afecta a este día.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Cuadrillas</legend>
          {crews.length === 0 && (
            <p className="text-sm text-ink-subtle">No hay cuadrillas registradas.</p>
          )}
          {crews.map((crew) => {
            const crewAssignmentItem = draft.find(
              (assignment) =>
                assignment.resourceType === 'crew' && assignment.resourceId === crew.id,
            );
            const isSelected = Boolean(crewAssignmentItem);
            const crewColor = colorFor(crew.color);
            const crewMembers = [
              ...(crewAssignmentItem?.members ?? []),
              ...crew.memberIds
                .map((memberId) => members.find((member) => member.id === memberId))
                .filter((member): member is WorkforceMember => Boolean(member))
                .map(({ id, name }) => ({ id, name })),
            ].filter(
              (member, index, all) => all.findIndex((item) => item.id === member.id) === index,
            );

            return (
              <div key={crew.id} className="rounded-xl border border-line p-3">
                <label className="flex min-h-10 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Incluir cuadrilla ${crew.label}`}
                    checked={isSelected}
                    disabled={crew.status !== 'active' && !isSelected}
                    onChange={(event) => toggleCrew(crew, event.target.checked)}
                  />
                  <span
                    className="inline-flex min-h-8 items-center rounded-full px-3 text-sm font-semibold"
                    style={{ backgroundColor: crewColor.fill, color: crewColor.ink }}
                  >
                    {crew.label}
                  </span>
                  {crew.status === 'inactive' && (
                    <span className="text-xs text-ink-subtle">Inactiva</span>
                  )}
                </label>
                {isSelected && (
                  <div className="ml-7 mt-2 space-y-1 border-l border-line pl-3">
                    <p className="text-xs font-semibold text-ink-subtle">
                      Personas de la cuadrilla
                    </p>
                    {crewMembers.map((member) => {
                      const included =
                        crewAssignmentItem?.members.some((item) => item.id === member.id) ?? false;
                      const currentMember = members.find((item) => item.id === member.id);
                      return (
                        <label key={member.id} className="flex min-h-9 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            aria-label={`Incluir ${member.name} en ${crew.label}`}
                            checked={included}
                            disabled={!included && currentMember?.status !== 'active'}
                            onChange={(event) =>
                              toggleCrewMember(crew.id, member.id, event.target.checked)
                            }
                          />
                          {member.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="mb-2 text-sm font-semibold text-ink">Personas</legend>
          {availableMembers.length === 0 && (
            <p className="text-sm text-ink-subtle">No hay personas individuales disponibles.</p>
          )}
          {availableMembers.map((member) => {
            const isSelected = draft.some(
              (assignment) =>
                assignment.resourceType === 'member' && assignment.resourceId === member.id,
            );
            return (
              <label key={member.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2">
                <input
                  type="checkbox"
                  aria-label={`Asignar persona ${member.name}`}
                  checked={isSelected}
                  disabled={member.status !== 'active' && !isSelected}
                  onChange={(event) => toggleMember(member, event.target.checked)}
                />
                <span className="text-sm font-medium text-ink">{member.name}</span>
                {member.status === 'inactive' && (
                  <span className="text-xs text-ink-subtle">Inactiva</span>
                )}
              </label>
            );
          })}
        </fieldset>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
          {hasOverride ? (
            <Button variant="ghost" type="button" disabled={saving} onClick={() => void reset()}>
              Restablecer predeterminados
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

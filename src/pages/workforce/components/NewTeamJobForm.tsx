import { useMemo, useRef, useState, type FormEvent } from 'react';
import { CirclePlus } from 'lucide-react';
import type { Project } from '@/entities/project';
import { buildTeamJobAssignment, validateTeamJobDraft } from '@/entities/workforce';
import type { TeamJob, TeamJobDraft, WorkCrew, WorkforceMember } from '@/entities/workforce';
import { generateId } from '@/shared/lib';
import { Alert, Button, Card, Field, Input, Modal, PageLink, Textarea } from '@/shared/ui';
import { teamErrorMessage } from '../model/teamErrors';
import { colorFor } from '@/entities/workforce';

interface NewTeamJobFormProps {
  initialDate: string;
  members: WorkforceMember[];
  crews: WorkCrew[];
  projects: Project[];
  onCreateMember: (name: string) => Promise<WorkforceMember>;
  onSavingChange: (saving: boolean) => void;
  onSave: (job: TeamJob) => Promise<void>;
}

function byLabel<T extends { label: string }>(left: T, right: T) {
  return left.label.localeCompare(right.label, 'es');
}

export function NewTeamJobForm({
  initialDate,
  members,
  crews,
  projects,
  onCreateMember,
  onSavingChange,
  onSave,
}: NewTeamJobFormProps) {
  const [date, setDate] = useState(initialDate);
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberError, setNewMemberError] = useState('');
  const [savingNewMember, setSavingNewMember] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const assignmentDate = useMemo(() => new Date().toISOString(), []);
  const activeMembers = useMemo(
    () =>
      members
        .filter((member) => member.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [members],
  );
  const activeCrews = useMemo(
    () => crews.filter((crew) => crew.status === 'active').sort(byLabel),
    [crews],
  );
  const activeMembersById = useMemo(
    () => new Map(activeMembers.map((member) => [member.id, member])),
    [activeMembers],
  );
  const crewMembersById = useMemo(
    () =>
      new Map(
        activeCrews.map((crew) => [
          crew.id,
          [...new Set(crew.memberIds)]
            .map((id) => activeMembersById.get(id))
            .filter((member): member is WorkforceMember => Boolean(member)),
        ]),
      ),
    [activeCrews, activeMembersById],
  );
  const selectedCrews = useMemo(
    () => activeCrews.filter((crew) => selectedCrewIds.includes(crew.id)),
    [activeCrews, selectedCrewIds],
  );
  const selectedCrewMemberIds = useMemo(
    () =>
      new Set(
        selectedCrews.flatMap((crew) =>
          (crewMembersById.get(crew.id) ?? []).map((member) => member.id),
        ),
      ),
    [selectedCrews, crewMembersById],
  );
  const selectedProject = projects.find((project) => project.id === projectId);
  const projectOptions = useMemo(
    () => [...projects].sort((a, b) => a.title.localeCompare(b.title, 'es')),
    [projects],
  );
  const assignments = useMemo(() => {
    const crewAssignments = selectedCrews.map((crew) =>
      buildTeamJobAssignment(
        { type: 'crew', resource: crew, members: crewMembersById.get(crew.id) ?? [] },
        assignmentDate,
      ),
    );
    const memberAssignments = selectedMemberIds
      .filter((id) => !selectedCrewMemberIds.has(id))
      .flatMap((id) => {
        const member = activeMembersById.get(id);
        return member
          ? [buildTeamJobAssignment({ type: 'member', resource: member }, assignmentDate)]
          : [];
      });
    return [...memberAssignments, ...crewAssignments];
  }, [
    activeMembersById,
    assignmentDate,
    crewMembersById,
    selectedCrewMemberIds,
    selectedCrews,
    selectedMemberIds,
  ]);
  const overlappingCrewIds = new Set<string>();
  for (const crew of selectedCrews) {
    for (const member of crewMembersById.get(crew.id) ?? []) overlappingCrewIds.add(member.id);
  }

  const chooseProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    if (!titleEdited) {
      setTitle(projects.find((project) => project.id === nextProjectId)?.title ?? '');
    }
  };

  const toggleMember = (member: WorkforceMember, checked: boolean) => {
    setSelectedMemberIds((current) =>
      checked ? [...new Set([...current, member.id])] : current.filter((id) => id !== member.id),
    );
  };

  const toggleCrew = (crew: WorkCrew, checked: boolean) => {
    if (checked) {
      const memberIds = new Set((crewMembersById.get(crew.id) ?? []).map((member) => member.id));
      setSelectedCrewIds((current) => [...new Set([...current, crew.id])]);
      setSelectedMemberIds((current) => current.filter((id) => !memberIds.has(id)));
    } else {
      setSelectedCrewIds((current) => current.filter((id) => id !== crew.id));
    }
  };

  const openMemberModal = () => {
    setNewMemberName('');
    setNewMemberError('');
    setMemberModalOpen(true);
  };

  const submitNewMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingNewMember) return;
    setSavingNewMember(true);
    setNewMemberError('');
    try {
      const member = await onCreateMember(newMemberName);
      setSelectedMemberIds((current) => [...new Set([...current, member.id])]);
      setMemberModalOpen(false);
    } catch (reason) {
      setNewMemberError(teamErrorMessage(reason, 'No se ha podido guardar la persona.'));
    } finally {
      setSavingNewMember(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    setError('');
    const project = projects.find((candidate) => candidate.id === projectId);
    const input: TeamJobDraft = {
      title,
      description,
      date,
      assignments,
      ...(project ? { projectId: project.id, projectTitle: project.title } : {}),
    };

    let draft: TeamJobDraft;
    try {
      draft = validateTeamJobDraft(input);
    } catch (validationError) {
      setError(
        teamErrorMessage(validationError, 'Revisa los datos del trabajo e inténtalo de nuevo.'),
      );
      return;
    }

    const now = new Date().toISOString();
    const job: TeamJob = { ...draft, id: generateId(), createdAt: now, updatedAt: now };
    savingRef.current = true;
    onSavingChange(true);
    try {
      await onSave(job);
    } catch (saveError) {
      setError(
        teamErrorMessage(saveError, 'No se ha podido guardar el trabajo. Vuelve a intentarlo.'),
      );
    } finally {
      savingRef.current = false;
      onSavingChange(false);
    }
  };

  return (
    <>
      <form
        id="team-job-form"
        onSubmit={(event) => void submit(event)}
        className="mx-auto max-w-2xl space-y-4"
      >
        <Card className="space-y-5 p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-ink-strong">Datos del trabajo</h2>
            <p className="mt-1 text-sm text-ink-subtle">
              Programa una visita puntual sin cambiar el avance de la obra.
            </p>
          </div>

          <Input
            id="team-job-date"
            type="date"
            label="Fecha"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />

          <Field
            id="team-job-project"
            label="Proyecto (opcional)"
            hint={
              selectedProject
                ? 'El trabajo queda enlazado a la obra sin reabrirla ni modificar su avance.'
                : undefined
            }
          >
            {(control) => (
              <select
                {...control}
                className="ui-control"
                value={projectId}
                onChange={(event) => chooseProject(event.target.value)}
              >
                <option value="">Sin proyecto</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                    {project.status === 'completed' ? ' · Finalizado' : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Input
            id="team-job-title"
            label="Título del trabajo"
            value={title}
            onChange={(event) => {
              setTitleEdited(true);
              setTitle(event.target.value);
            }}
            maxLength={120}
            placeholder={
              selectedProject ? 'Por ejemplo, Repaso final' : 'Por ejemplo, Remate de cocina'
            }
            required
          />

          <Textarea
            id="team-job-description"
            label="Descripción (opcional)"
            hint={
              projectId
                ? undefined
                : 'El título es obligatorio; puedes dejar la descripción en blanco.'
            }
            className="min-h-28"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2_000}
            placeholder="Describe qué hay que revisar o rematar."
          />
        </Card>

        <Card className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-strong">Equipo asignado</h2>
              <p className="mt-1 text-sm text-ink-subtle">
                Elige una o más personas o cuadrillas activas.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={openMemberModal}>
              <CirclePlus size={17} aria-hidden="true" />
              Añadir persona
            </Button>
          </div>

          {activeMembers.length === 0 && activeCrews.length === 0 ? (
            <div className="rounded-xl bg-surface-muted p-4">
              <p className="text-sm text-ink-muted">No hay personas ni cuadrillas activas.</p>
              <PageLink
                to="/team/manage"
                className="mt-2 inline-block text-sm font-semibold text-primary underline"
              >
                Gestionar equipo
              </PageLink>
            </div>
          ) : (
            <>
              {activeMembers.length > 0 && (
                <fieldset className="space-y-1">
                  <legend className="mb-2 text-sm font-semibold text-ink">Personas</legend>
                  {activeMembers.map((member) => {
                    const includedInCrew = selectedCrewMemberIds.has(member.id);
                    return (
                      <label
                        key={member.id}
                        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 ${includedInCrew ? 'cursor-not-allowed bg-surface-muted opacity-65' : 'cursor-pointer hover:bg-surface-muted'}`}
                      >
                        <input
                          type="checkbox"
                          checked={includedInCrew || selectedMemberIds.includes(member.id)}
                          disabled={includedInCrew}
                          onChange={(event) => toggleMember(member, event.target.checked)}
                          className="size-4 accent-primary"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                          {member.name}
                        </span>
                        {includedInCrew && (
                          <span className="text-xs text-ink-subtle">En cuadrilla</span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              )}

              {activeCrews.length > 0 && (
                <fieldset className="space-y-1 border-t border-line pt-4">
                  <legend className="mb-2 text-sm font-semibold text-ink">Cuadrillas</legend>
                  {activeCrews.map((crew) => {
                    const selected = selectedCrewIds.includes(crew.id);
                    const crewMembers = crewMembersById.get(crew.id) ?? [];
                    const overlaps =
                      !selected &&
                      crewMembers.some(
                        (member) =>
                          overlappingCrewIds.has(member.id) ||
                          selectedMemberIds.includes(member.id),
                      );
                    const color = colorFor(crew.color);
                    return (
                      <label
                        key={crew.id}
                        className={`flex min-h-12 items-center gap-3 rounded-lg px-3 ${overlaps ? 'cursor-not-allowed bg-surface-muted opacity-65' : 'cursor-pointer hover:bg-surface-muted'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={overlaps || crewMembers.length === 0}
                          onChange={(event) => toggleCrew(crew, event.target.checked)}
                          className="size-4 accent-primary"
                        />
                        <span
                          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold"
                          style={{ backgroundColor: color.fill, color: color.ink }}
                        >
                          {crew.label}
                          <span className="ml-2 text-xs font-normal opacity-80">
                            {crewMembers.map((member) => member.name).join(', ') ||
                              'Sin integrantes activos'}
                          </span>
                        </span>
                        {overlaps && (
                          <span className="text-xs text-ink-subtle">Recurso repetido</span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </>
          )}
        </Card>

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
      <Modal
        open={memberModalOpen}
        onClose={() => {
          if (!savingNewMember) setMemberModalOpen(false);
        }}
        title="Añadir persona"
      >
        <form onSubmit={(event) => void submitNewMember(event)} className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-ink-strong">Añadir persona</h2>
            <p className="mt-1 text-sm leading-5 text-ink-subtle">
              Se guardará como activa y quedará asignada a este trabajo.
            </p>
          </div>
          <Input
            autoFocus
            id="new-work-member-name"
            label="Nombre"
            value={newMemberName}
            onChange={(event) => setNewMemberName(event.target.value)}
            maxLength={120}
            autoComplete="name"
            required
          />
          {newMemberError && <Alert tone="danger">{newMemberError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={savingNewMember}
              onClick={() => setMemberModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={savingNewMember}>
              Añadir y asignar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { CirclePlus, Pencil, UsersRound } from 'lucide-react';
import { useWorkforceStore, type WorkCrew, type WorkforceMember } from '@/entities/workforce';
import { Badge, Button, IconButton } from '@/shared/ui';
import { CrewDialog, MemberDialog } from './components/TeamDialogs';
import { TeamPageFrame } from './components/TeamPageFrame';
import { TEAM_COPY } from './model/copy';
import { colorFor } from '@/entities/workforce';
import { useTeamContext } from './model/teamContext';

type EditTarget =
  { type: 'member'; item: WorkforceMember | null } | { type: 'crew'; item: WorkCrew | null } | null;

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <Badge tone={status === 'active' ? 'success' : 'neutral'} className="min-h-7">
      {status === 'active' ? 'Activa' : 'Inactiva'}
    </Badge>
  );
}

function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-xl font-semibold text-ink-strong">
          {title}
        </h2>
        <p className="mt-1 text-sm text-ink-subtle">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface p-6 sm:p-8">
      <p className="font-medium text-ink">{title}</p>
      {children}
    </div>
  );
}

const rowCardClass = 'rounded-xl border border-line bg-surface shadow-card';

/** `/team/manage`: people and crews with their active state. */
export function TeamManagePage() {
  const { data } = useTeamContext();
  const members = useWorkforceStore((state) => state.members);
  const crews = useWorkforceStore((state) => state.crews);
  const saveMember = useWorkforceStore((state) => state.saveMember);
  const saveCrew = useWorkforceStore((state) => state.saveCrew);
  const setMemberStatus = useWorkforceStore((state) => state.setMemberStatus);
  const setCrewStatus = useWorkforceStore((state) => state.setCrewStatus);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members],
  );

  const toggleStatus = async (key: string, operation: () => Promise<unknown>) => {
    setBusy(key);
    data.clearError();
    try {
      await operation();
    } catch (error) {
      data.reportError(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <TeamPageFrame
      title={TEAM_COPY.manageTitle}
      description={TEAM_COPY.manageDescription}
      backTo="/team"
      descriptionAndActionsBelowTitle
      actions={
        <div className="flex shrink-0 gap-2">
          <IconButton
            variant="secondary"
            label="Crear cuadrilla"
            icon={<UsersRound size={18} aria-hidden="true" />}
            onClick={() => setEditing({ type: 'crew', item: null })}
          />
          <IconButton
            variant="primary"
            label="Añadir persona"
            icon={<CirclePlus size={18} aria-hidden="true" />}
            onClick={() => setEditing({ type: 'member', item: null })}
          />
        </div>
      }
    >
      <section aria-label="Gestión de personas y cuadrillas">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="team-members-title">
            <SectionHeading
              id="team-members-title"
              title="Personas"
              description={`${activeMembers.length} activas de ${members.length}`}
              action={
                <Button
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setEditing({ type: 'member', item: null })}
                >
                  <CirclePlus size={17} aria-hidden="true" />
                  Añadir
                </Button>
              }
            />
            {members.length === 0 ? (
              <EmptyCard title="Empieza por registrar a tu equipo">
                <p className="mt-1 max-w-md text-sm leading-6 text-ink-subtle">
                  Añade a las personas que trabajan en tus obras. Después podrás agruparlas y
                  asignarlas a proyectos.
                </p>
                <Button className="mt-5" onClick={() => setEditing({ type: 'member', item: null })}>
                  Añadir primera persona
                </Button>
              </EmptyCard>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className={`${rowCardClass} flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-semibold text-gray-800">{member.name}</h3>
                        <StatusBadge status={member.status} />
                      </div>
                      <p className="mt-1 text-xs text-ink-subtle">
                        En {crews.filter((crew) => crew.memberIds.includes(member.id)).length}{' '}
                        cuadrillas
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        aria-label={`Editar a ${member.name}`}
                        onClick={() => setEditing({ type: 'member', item: member })}
                      >
                        <Pencil size={16} aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="secondary"
                        loading={busy === `member:${member.id}`}
                        aria-label={`${member.status === 'active' ? 'Desactivar' : 'Reactivar'} a ${member.name}`}
                        onClick={() =>
                          void toggleStatus(`member:${member.id}`, () =>
                            setMemberStatus(
                              member.id,
                              member.status === 'active' ? 'inactive' : 'active',
                            ),
                          )
                        }
                      >
                        {member.status === 'active' ? 'Desactivar' : 'Reactivar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="team-crews-title">
            <SectionHeading
              id="team-crews-title"
              title="Cuadrillas"
              description="Cada cuadrilla puede compartir integrantes con otras."
              action={
                <Button
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setEditing({ type: 'crew', item: null })}
                >
                  <CirclePlus size={17} aria-hidden="true" />
                  Crear
                </Button>
              }
            />
            {crews.length === 0 ? (
              <EmptyCard title="Todavía no hay cuadrillas">
                <p className="mt-1 max-w-md text-sm leading-6 text-ink-subtle">
                  Ponles una etiqueta y un color para reconocerlas rápido al asignarlas a un
                  proyecto.
                </p>
                <Button
                  variant="secondary"
                  className="mt-5"
                  disabled={activeMembers.length === 0}
                  onClick={() => setEditing({ type: 'crew', item: null })}
                >
                  Crear cuadrilla
                </Button>
                {activeMembers.length === 0 && (
                  <p className="mt-3 text-xs text-ink-subtle">Añade primero una persona activa.</p>
                )}
              </EmptyCard>
            ) : (
              <div className="space-y-2">
                {crews.map((crew) => {
                  const crewColor = colorFor(crew.color);
                  const crewMembers = crew.memberIds
                    .map((id) => members.find((member) => member.id === id))
                    .filter((member): member is WorkforceMember => !!member);
                  const crewActiveCount = crewMembers.filter(
                    (member) => member.status === 'active',
                  ).length;
                  return (
                    <div
                      key={crew.id}
                      className={`${rowCardClass} flex flex-wrap items-start justify-between gap-3 overflow-hidden p-4 sm:px-5`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className="inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-sm font-semibold"
                            style={{ backgroundColor: crewColor.fill, color: crewColor.ink }}
                          >
                            <span
                              aria-hidden="true"
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: crewColor.dot }}
                            />
                            {crew.label}
                          </span>
                          <StatusBadge status={crew.status} />
                        </div>
                        <p className="mt-2 text-sm leading-5 text-ink-muted">
                          {crewMembers.map((member) => member.name).join(', ') || 'Sin integrantes'}
                        </p>
                        {crewActiveCount === 0 ? (
                          <p className="mt-1 text-xs font-medium text-warning-ink">
                            Sin integrantes activos
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-ink-subtle">
                            {crewActiveCount}{' '}
                            {crewActiveCount === 1 ? 'persona activa' : 'personas activas'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          aria-label={`Editar cuadrilla ${crew.label}`}
                          onClick={() => setEditing({ type: 'crew', item: crew })}
                        >
                          <Pencil size={16} aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">Editar</span>
                        </Button>
                        <Button
                          variant="secondary"
                          loading={busy === `crew:${crew.id}`}
                          aria-label={`${crew.status === 'active' ? 'Desactivar' : 'Reactivar'} cuadrilla ${crew.label}`}
                          onClick={() =>
                            void toggleStatus(`crew:${crew.id}`, () =>
                              setCrewStatus(
                                crew.id,
                                crew.status === 'active' ? 'inactive' : 'active',
                              ),
                            )
                          }
                        >
                          {crew.status === 'active' ? 'Desactivar' : 'Reactivar'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>

      {editing?.type === 'member' && (
        <MemberDialog member={editing.item} onSave={saveMember} onClose={() => setEditing(null)} />
      )}
      {editing?.type === 'crew' && (
        <CrewDialog
          crew={editing.item}
          members={members}
          onSave={saveCrew}
          onClose={() => setEditing(null)}
        />
      )}
    </TeamPageFrame>
  );
}

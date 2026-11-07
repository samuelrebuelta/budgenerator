import { useEffect, useMemo, useState } from 'react';
import { UserRound, UsersRound, X } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import {
  findAssignmentWithOverlappingMember,
  findCrewAssignmentForMember,
  useProjectStore,
} from '@/entities/project';
import { useWorkforceStore } from '@/entities/workforce';
import type { WorkCrew, WorkforceMember } from '@/entities/workforce';
import type { ProjectDetail } from '@/entities/project';
import type { CrewColor } from '@/shared/types';
import { Button, Card, Modal, PageLink } from '@/shared/ui';
import { OfflineUnavailable } from '@/shared/ui/OfflineUnavailable';
import { reportNetworkUnavailable, useNetworkStore } from '@/shared/model/network';

interface ProjectTeamAssignmentsProps {
  project: ProjectDetail;
}

const CREW_STYLE: Record<CrewColor, { card: string; dot: string }> = {
  blue: { card: 'border-[#bfd0c8] bg-[#eaf1ed] text-[#183e3b]', dot: '#367760' },
  green: { card: 'border-[#d5dfc7] bg-[#edf2e7] text-[#354b27]', dot: '#648b43' },
  amber: { card: 'border-[#e8d4ae] bg-[#f8f0e1] text-[#68420d]', dot: '#b4771e' },
  rose: { card: 'border-[#e8cece] bg-[#f7eaea] text-[#733a3e]', dot: '#b45e67' },
  violet: { card: 'border-[#d9cfe4] bg-[#f0ebf5] text-[#514069]', dot: '#8062a6' },
  cyan: { card: 'border-[#c8dfde] bg-[#e6f2f1] text-[#28575a]', dot: '#3b8e94' },
  slate: { card: 'border-[#d5d9d6] bg-[#eceeec] text-[#3f4844]', dot: '#68756e' },
};

function activeCrewMembers(crew: WorkCrew, members: WorkforceMember[]) {
  const activeById = new Map(
    members.filter((member) => member.status === 'active').map((member) => [member.id, member]),
  );
  return [...new Set(crew.memberIds)]
    .map((id) => activeById.get(id))
    .filter((member): member is WorkforceMember => Boolean(member));
}

function errorText(error: unknown) {
  if (!(error instanceof Error)) return 'No se ha podido actualizar la asignación.';
  const message = error.message.toLocaleLowerCase('es');
  if (message.includes('permission') || message.includes('insufficient'))
    return 'No tienes permiso para modificar este proyecto.';
  if (message.includes('offline') || message.includes('network') || message.includes('unavailable'))
    return 'No hay conexión con el servicio. Vuelve a intentarlo.';
  return error.message;
}

export function ProjectTeamAssignments({ project }: ProjectTeamAssignmentsProps) {
  const uid = useAuthStore((state) => state.user?.uid);
  const online = useNetworkStore((state) => state.online);
  const browserOnline = useNetworkStore((state) => state.browserOnline);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const members = useWorkforceStore((state) => state.members);
  const crews = useWorkforceStore((state) => state.crews);
  const loaded = useWorkforceStore((state) => state.loaded);
  const loadedUid = useWorkforceStore((state) => state.loadedUid);
  const loadWorkforce = useWorkforceStore((state) => state.loadWorkforce);
  const addAssignment = useProjectStore((state) => state.addAssignment);
  const removeAssignment = useProjectStore((state) => state.removeAssignment);
  const [loadFailure, setLoadFailure] = useState<{ uid: string; error: string } | null>(null);
  const [actionError, setActionError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState('');
  const ready = Boolean(uid && loaded && loadedUid === uid);
  const loadError = loadFailure && loadFailure.uid === uid ? loadFailure.error : '';
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members],
  );
  const availableCrews = useMemo(
    () =>
      crews.filter(
        (crew) => crew.status === 'active' && activeCrewMembers(crew, members).length > 0,
      ),
    [crews, members],
  );

  useEffect(() => {
    if (!uid) return;
    if (!browserOnline && !(loaded && loadedUid === uid)) return;
    let current = true;
    void loadWorkforce(uid).catch((error: unknown) => {
      reportNetworkUnavailable(error);
      if (current) setLoadFailure({ uid, error: errorText(error) });
    });
    return () => {
      current = false;
    };
  }, [uid, loadWorkforce, browserOnline, loaded, loadedUid, dataRefreshVersion]);

  const assign = async (resourceType: 'member' | 'crew', resourceId: string) => {
    const id = `${resourceType}_${resourceId}`;
    setBusyId(id);
    setActionError('');
    try {
      await addAssignment(project.id, resourceType, resourceId);
      setDialogOpen(false);
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setBusyId('');
    }
  };

  const remove = async (assignmentId: string) => {
    setBusyId(assignmentId);
    setActionError('');
    try {
      await removeAssignment(project.id, assignmentId);
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setBusyId('');
    }
  };

  return (
    <Card className="mb-8 overflow-hidden border-[#d7dbd2] shadow-none">
      <section aria-labelledby="team-assignments-title" className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="team-assignments-title" className="text-lg font-semibold text-[#1f2b26]">
              Equipo asignado
            </h2>
            <p className="mt-1 text-sm text-[#52625a]">
              Las asignaciones guardan una instantánea de los nombres y la composición actuales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PageLink
              to="/team"
              className="inline-flex min-h-11 items-center rounded-full border border-[#c9cfc7] px-4 text-sm font-medium text-[#1f5d56] hover:bg-[#f3f6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7694d]"
            >
              Gestionar equipo
            </PageLink>
            <Button
              variant="secondary"
              className="rounded-full px-4"
              disabled={!ready}
              onClick={() => setDialogOpen(true)}
            >
              Asignar equipo
            </Button>
          </div>
        </div>

        {loadError ? (
          <div className="mt-4 rounded-xl bg-[#f8efec] p-4">
            <p role="alert" className="text-sm text-[#83452f]">
              {loadError}
            </p>
            <Button
              variant="ghost"
              className="mt-2"
              onClick={() => {
                setLoadFailure(null);
                if (uid)
                  void loadWorkforce(uid).catch((error: unknown) => {
                    reportNetworkUnavailable(error);
                    setLoadFailure({ uid, error: errorText(error) });
                  });
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : !ready && online ? (
          <p className="mt-5 text-sm text-[#637166]" role="status">
            Cargando personas y cuadrillas…
          </p>
        ) : !ready ? (
          <div className="mt-5">
            <OfflineUnavailable />
          </div>
        ) : project.assignments.length === 0 ? (
          <p className="mt-5 rounded-xl bg-[#f6f6f0] px-4 py-3 text-sm text-[#637166]">
            Todavía no hay personas ni cuadrillas asignadas a este proyecto.
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Asignaciones del proyecto">
            {project.assignments.map((assignment) => {
              const color = assignment.color ? CREW_STYLE[assignment.color] : null;
              return (
                <li
                  key={assignment.id}
                  className={`min-w-0 rounded-xl border p-4 ${color?.card ?? 'border-[#d7dbd2] bg-[#f7f7f3] text-[#1f2b26]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/75"
                        aria-hidden="true"
                      >
                        {assignment.resourceType === 'crew' ? (
                          <UsersRound size={15} />
                        ) : (
                          <UserRound size={15} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{assignment.label}</h3>
                        <p className="mt-1 text-xs opacity-80">
                          {assignment.resourceType === 'crew' ? 'Cuadrilla' : 'Persona'} ·{' '}
                          {assignment.members.length}{' '}
                          {assignment.members.length === 1 ? 'integrante' : 'integrantes'}
                        </p>
                        <ul
                          className="mt-2 flex flex-wrap gap-1.5"
                          aria-label={`Integrantes de ${assignment.label}`}
                        >
                          {assignment.members.map((member) => (
                            <li
                              key={member.id}
                              className="rounded-full bg-white/70 px-2.5 py-1 text-xs"
                            >
                              {member.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="h-9 min-h-9 shrink-0 rounded-full p-2"
                      aria-label={`Quitar asignación de ${assignment.label}`}
                      disabled={Boolean(busyId)}
                      loading={busyId === assignment.id}
                      onClick={() => void remove(assignment.id)}
                    >
                      {busyId !== assignment.id && <X size={16} aria-hidden="true" />}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {actionError && (
          <p role="alert" className="mt-4 text-sm text-[#83452f]">
            {actionError}
          </p>
        )}
      </section>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Asignar equipo al proyecto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1f2b26]">Asignar equipo</h2>
            <p className="mt-1 text-sm text-[#52625a]">Elige una persona o una cuadrilla activa.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="-mr-2 -mt-2 min-h-10 rounded-full p-2"
            aria-label="Cerrar"
            onClick={() => setDialogOpen(false)}
          >
            <X size={17} aria-hidden="true" />
          </Button>
        </div>
        {activeMembers.length === 0 && availableCrews.length === 0 ? (
          <div className="mt-5 rounded-xl bg-[#f6f6f0] p-4">
            <p className="text-sm text-[#52625a]">No hay recursos activos disponibles.</p>
            <PageLink
              to="/team"
              className="mt-3 inline-block text-sm font-semibold text-[#1f5d56] underline"
            >
              Gestionar equipo
            </PageLink>
          </div>
        ) : (
          <div className="mt-5 max-h-[55vh] space-y-5 overflow-y-auto pr-1">
            {activeMembers.length > 0 && (
              <section aria-labelledby="assign-members-title">
                <h3 id="assign-members-title" className="mb-2 text-sm font-semibold text-[#1f2b26]">
                  Personas
                </h3>
                <ul className="divide-y divide-[#ecece4] rounded-xl border border-[#e1e3dc]">
                  {activeMembers.map((member) => {
                    const assigned = project.assignments.some(
                      (item) => item.resourceType === 'member' && item.resourceId === member.id,
                    );
                    const assignedCrew = findCrewAssignmentForMember(
                      member.id,
                      project.assignments,
                    );
                    return (
                      <li key={member.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-[#1f2b26]">{member.name}</span>
                          {!assigned && assignedCrew && (
                            <p className="mt-0.5 text-xs text-[#637166]">
                              Incluida en {assignedCrew.label}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          aria-label={
                            !assigned && assignedCrew
                              ? `Incluida en ${assignedCrew.label}`
                              : undefined
                          }
                          disabled={assigned || Boolean(assignedCrew) || Boolean(busyId)}
                          loading={busyId === `member_${member.id}`}
                          onClick={() => void assign('member', member.id)}
                        >
                          {assigned ? 'Asignada' : assignedCrew ? 'En cuadrilla' : 'Asignar'}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {availableCrews.length > 0 && (
              <section aria-labelledby="assign-crews-title">
                <h3 id="assign-crews-title" className="mb-2 text-sm font-semibold text-[#1f2b26]">
                  Cuadrillas
                </h3>
                <ul className="divide-y divide-[#ecece4] rounded-xl border border-[#e1e3dc]">
                  {availableCrews.map((crew) => {
                    const assigned = project.assignments.some(
                      (item) => item.resourceType === 'crew' && item.resourceId === crew.id,
                    );
                    const crewMembers = activeCrewMembers(crew, members);
                    const count = crewMembers.length;
                    const overlappingAssignment = findAssignmentWithOverlappingMember(
                      crewMembers.map((member) => member.id),
                      project.assignments,
                      `crew_${crew.id}`,
                    );
                    const overlapDescription = overlappingAssignment
                      ? overlappingAssignment.resourceType === 'member'
                        ? `Incluye a ${overlappingAssignment.label}, ya asignada individualmente`
                        : `Comparte integrantes con ${overlappingAssignment.label}, ya asignada`
                      : '';
                    return (
                      <li key={crew.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: CREW_STYLE[crew.color].dot }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-medium text-[#1f2b26]">
                              {crew.label}
                              <span className="ml-2 text-xs font-normal text-[#637166]">
                                {count} {count === 1 ? 'integrante activo' : 'integrantes activos'}
                              </span>
                            </span>
                            {overlapDescription && (
                              <span className="mt-0.5 block text-xs text-[#8a5418]">
                                {overlapDescription}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          aria-label={
                            overlapDescription ? `No disponible: ${overlapDescription}` : undefined
                          }
                          disabled={assigned || Boolean(overlappingAssignment) || Boolean(busyId)}
                          loading={busyId === `crew_${crew.id}`}
                          onClick={() => void assign('crew', crew.id)}
                        >
                          {assigned ? 'Asignada' : 'Asignar'}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
        {actionError && (
          <p role="alert" className="mt-4 text-sm text-[#83452f]">
            {actionError}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
            Cerrar
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

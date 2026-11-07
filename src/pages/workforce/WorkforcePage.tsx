import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, CirclePlus, Pencil, UsersRound } from 'lucide-react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { getWeekDateKeys, useProjectStore } from '@/entities/project';
import type { ProjectAssignment, ProjectTeamScheduleData } from '@/entities/project';
import { useWorkforceStore } from '@/entities/workforce';
import type { WorkCrew, WorkforceMember } from '@/entities/workforce';
import type { CrewColor } from '@/shared/types';
import { generateId } from '@/shared/lib';
import { Button, Card, Input, Modal, OfflineUnavailable, PageHeader } from '@/shared/ui';
import { usePageNavigation } from '@/shared/ui/page-view-transition';
import {
  getMemoryResource,
  loadMemoryResource,
  setMemoryResource,
} from '@/shared/lib/memoryResourceCache';
import { reportNetworkUnavailable, useNetworkStore } from '@/shared/model/network';
import { colorFor, CREW_COLORS } from './crewColors';
import { WeeklyProjectSchedule } from './WeeklyProjectSchedule';
import { NewTeamJobForm } from './NewTeamJobForm';

const EMPTY_TEAM_SCHEDULE: ProjectTeamScheduleData = {
  assignmentsByProjectId: {},
  overridesByProjectDate: {},
};

function userFacingError(error: unknown) {
  if (!(error instanceof Error)) return 'No se ha podido guardar. Vuelve a intentarlo.';
  const message = error.message.toLocaleLowerCase('es');
  if (message.includes('permission') || message.includes('insufficient'))
    return 'No tienes permiso para modificar el equipo de esta cuenta.';
  if (message.includes('offline') || message.includes('network') || message.includes('unavailable'))
    return 'No hay conexión con el servicio. Comprueba la red y vuelve a intentarlo.';
  return error.message;
}

function validDateKey(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!, 12);
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day;
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${
        status === 'active' ? 'bg-[#e3edd7] text-[#354b27]' : 'bg-[#e8e7e1] text-[#5e645f]'
      }`}
    >
      {status === 'active' ? 'Activa' : 'Inactiva'}
    </span>
  );
}

export function WorkforcePage() {
  const { view } = useParams();
  const location = useLocation();
  const isManagementPage = view === 'manage';
  const isNewWorkPage = view === 'new-work' || location.pathname === '/team/jobs/new';
  const [searchParams] = useSearchParams();
  const queryDateKey = validDateKey(searchParams.get('date'))
    ? searchParams.get('date')!
    : undefined;
  const initialDateKey = queryDateKey ?? localDateKey(new Date());
  const { navigate } = usePageNavigation();
  const uid = useAuthStore((state) => state.user?.uid);
  const online = useNetworkStore((state) => state.online);
  const browserOnline = useNetworkStore((state) => state.browserOnline);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const projects = useProjectStore((state) => state.projects);
  const projectsLoaded = useProjectStore((state) => state.loaded);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const loadTeamSchedule = useProjectStore((state) => state.loadTeamSchedule);
  const saveDailyAssignments = useProjectStore((state) => state.saveDailyAssignments);
  const removeDailyAssignmentOverride = useProjectStore(
    (state) => state.removeDailyAssignmentOverride,
  );
  const members = useWorkforceStore((state) => state.members);
  const crews = useWorkforceStore((state) => state.crews);
  const loaded = useWorkforceStore((state) => state.loaded);
  const loadWorkforce = useWorkforceStore((state) => state.loadWorkforce);
  const saveMember = useWorkforceStore((state) => state.saveMember);
  const saveCrew = useWorkforceStore((state) => state.saveCrew);
  const setMemberStatus = useWorkforceStore((state) => state.setMemberStatus);
  const setCrewStatus = useWorkforceStore((state) => state.setCrewStatus);
  const teamJobs = useWorkforceStore((state) => state.teamJobs);
  const teamJobsRange = useWorkforceStore((state) => state.teamJobsRange);
  const loadTeamJobs = useWorkforceStore((state) => state.loadTeamJobs);
  const createTeamJob = useWorkforceStore((state) => state.createTeamJob);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailure, setLoadFailure] = useState<{ key: string; error: string } | null>(null);
  const lastSchedule = uid
    ? getMemoryResource<{ dateKeys: string[]; data: ProjectTeamScheduleData }>(
        `private:${uid}:team-schedule:last`,
      )
    : undefined;
  const [scheduleData, setScheduleData] = useState(() => lastSchedule?.data ?? EMPTY_TEAM_SCHEDULE);
  const [scheduleDateKeys, setScheduleDateKeys] = useState(() =>
    queryDateKey
      ? getWeekDateKeys(dateFromKey(queryDateKey))
      : !online && lastSchedule
        ? lastSchedule.dateKeys
        : getWeekDateKeys(new Date()),
  );
  const [scheduleAttempt, setScheduleAttempt] = useState(0);
  const [scheduleFailure, setScheduleFailure] = useState<{ key: string; error: string } | null>(
    null,
  );
  const scheduleResourceLoads = useRef(new Map<string, Promise<ProjectTeamScheduleData | null>>());
  const [loadedScheduleKey, setLoadedScheduleKey] = useState('');
  const [jobsAttempt, setJobsAttempt] = useState(0);
  const [jobsFailure, setJobsFailure] = useState<{ key: string; error: string } | null>(null);
  const [loadedJobsKey, setLoadedJobsKey] = useState('');
  const [memberModal, setMemberModal] = useState(false);
  const [crewModal, setCrewModal] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkforceMember | null>(null);
  const [editingCrew, setEditingCrew] = useState<WorkCrew | null>(null);
  const [memberName, setMemberName] = useState('');
  const [crewLabel, setCrewLabel] = useState('');
  const [crewColor, setCrewColor] = useState<CrewColor>('blue');
  const [crewMemberIds, setCrewMemberIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [teamJobSaving, setTeamJobSaving] = useState(false);
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members],
  );
  const loadKey = `${uid ?? ''}:${loadAttempt}`;
  const loadError = loadFailure?.key === loadKey ? loadFailure.error : '';
  const projectIds = useMemo(() => projects.map((project) => project.id).sort(), [projects]);
  const projectIdsKey = projectIds.join('|');
  const dateKeysKey = scheduleDateKeys.join('|');
  const teamJobsStartDate = scheduleDateKeys[0]!;
  const teamJobsEndDate = scheduleDateKeys[6]!;
  const jobsKey = `${uid ?? ''}:${jobsAttempt}:${teamJobsStartDate}:${teamJobsEndDate}`;
  const jobsError = jobsFailure?.key === jobsKey ? jobsFailure.error : '';
  const jobsLoading = online && loadedJobsKey !== jobsKey;
  const jobsUnavailable =
    !online &&
    (!teamJobsRange ||
      teamJobsRange.uid !== uid ||
      teamJobsRange.startDate !== teamJobsStartDate ||
      teamJobsRange.endDate !== teamJobsEndDate);
  const scheduleResourceKey = `private:${uid ?? ''}:team-schedule:${projectIdsKey}:${dateKeysKey}`;
  const cachedSchedule = uid
    ? getMemoryResource<ProjectTeamScheduleData>(scheduleResourceKey)
    : undefined;
  const scheduleKey = `${uid ?? ''}:${scheduleAttempt}:${projectIdsKey}:${dateKeysKey}`;
  const scheduleError = scheduleFailure?.key === scheduleKey ? scheduleFailure.error : '';
  const scheduleLoading =
    online && loadedScheduleKey !== scheduleKey && cachedSchedule === undefined;
  const scheduleUnavailable = !online && cachedSchedule === undefined;
  const visibleScheduleData = cachedSchedule ?? scheduleData;

  const loadScheduleResource = useCallback(
    (resourceKey: string, dateKeys: string[], refresh: boolean) => {
      const pending = scheduleResourceLoads.current.get(resourceKey);
      if (pending) return pending;
      const cached = getMemoryResource<ProjectTeamScheduleData>(resourceKey);
      if (!refresh && cached !== undefined) return Promise.resolve(cached);
      if (!uid) return Promise.reject(new Error('No hay una sesión activa.'));

      const request = loadMemoryResource<ProjectTeamScheduleData | null>(resourceKey, () =>
        loadTeamSchedule(uid, projectIds, dateKeys),
      ).finally(() => {
        if (scheduleResourceLoads.current.get(resourceKey) === request)
          scheduleResourceLoads.current.delete(resourceKey);
      });
      scheduleResourceLoads.current.set(resourceKey, request);
      return request;
    },
    [loadTeamSchedule, projectIds, uid],
  );

  useEffect(() => {
    if (!uid) return;
    if (!browserOnline && (!loaded || !projectsLoaded)) return;
    let current = true;
    void Promise.all([loadWorkforce(uid), loadProjects(uid)]).catch((error: unknown) => {
      reportNetworkUnavailable(error);
      if (current) setLoadFailure({ key: loadKey, error: userFacingError(error) });
    });
    return () => {
      current = false;
    };
  }, [
    uid,
    loadAttempt,
    loadWorkforce,
    loadProjects,
    loadKey,
    browserOnline,
    loaded,
    projectsLoaded,
    dataRefreshVersion,
  ]);

  useEffect(() => {
    if (!uid || !online || !projectsLoaded) return;
    let current = true;
    void loadTeamJobs(uid, teamJobsStartDate, teamJobsEndDate)
      .then(() => {
        if (!current) return;
        setJobsFailure(null);
        setLoadedJobsKey(jobsKey);
      })
      .catch((error: unknown) => {
        reportNetworkUnavailable(error);
        if (current) {
          setJobsFailure({ key: jobsKey, error: userFacingError(error) });
          setLoadedJobsKey(jobsKey);
        }
      });
    return () => {
      current = false;
    };
  }, [
    uid,
    online,
    projectsLoaded,
    teamJobsStartDate,
    teamJobsEndDate,
    jobsAttempt,
    jobsKey,
    loadTeamJobs,
    dataRefreshVersion,
  ]);

  useEffect(() => {
    if (!uid || !projectsLoaded) return;
    let current = true;
    void loadScheduleResource(scheduleResourceKey, scheduleDateKeys, true)
      .then((data) => {
        if (!current) return;
        if (data) {
          setScheduleData(data);
          setMemoryResource(`private:${uid}:team-schedule:last`, {
            dateKeys: scheduleDateKeys,
            data,
          });
        }
        setScheduleFailure(null);
        setLoadedScheduleKey(scheduleKey);
      })
      .catch((error: unknown) => {
        reportNetworkUnavailable(error);
        if (current) {
          setScheduleFailure({ key: scheduleKey, error: userFacingError(error) });
          setLoadedScheduleKey(scheduleKey);
        }
      });
    return () => {
      current = false;
    };
  }, [
    uid,
    projectsLoaded,
    projectIds,
    projectIdsKey,
    scheduleDateKeys,
    dateKeysKey,
    scheduleAttempt,
    loadScheduleResource,
    scheduleKey,
    scheduleResourceKey,
    dataRefreshVersion,
  ]);

  useEffect(() => {
    if (!uid || !projectsLoaded || !online || projectIds.length === 0) return;
    const [year, month, day] = scheduleDateKeys[0]!.split('-').map(Number);
    const currentWeek = new Date(year!, month! - 1, day!, 12);

    for (const offset of [-1, 1]) {
      const adjacentWeek = new Date(
        currentWeek.getFullYear(),
        currentWeek.getMonth(),
        currentWeek.getDate() + offset * 7,
        12,
      );
      const adjacentDateKeys = getWeekDateKeys(adjacentWeek);
      const adjacentResourceKey = `private:${uid}:team-schedule:${projectIdsKey}:${adjacentDateKeys.join('|')}`;
      if (
        getMemoryResource<ProjectTeamScheduleData>(adjacentResourceKey) !== undefined ||
        scheduleResourceLoads.current.has(adjacentResourceKey)
      )
        continue;
      void loadScheduleResource(adjacentResourceKey, adjacentDateKeys, false).catch(() => {
        // La navegación normal conserva su lectura y muestra el error sólo si se abre esa semana.
      });
    }
  }, [
    uid,
    projectsLoaded,
    online,
    projectIds,
    projectIdsKey,
    scheduleDateKeys,
    dateKeysKey,
    dataRefreshVersion,
    loadScheduleResource,
  ]);

  const openMember = (member?: WorkforceMember) => {
    setEditingMember(member ?? null);
    setMemberName(member?.name ?? '');
    setFormError('');
    setMemberModal(true);
  };

  const openCrew = (crew?: WorkCrew) => {
    setEditingCrew(crew ?? null);
    setCrewLabel(crew?.label ?? '');
    setCrewColor(crew?.color ?? 'blue');
    setCrewMemberIds(crew?.memberIds ?? []);
    setFormError('');
    setCrewModal(true);
  };

  const submitMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const nextMember: WorkforceMember = {
      id: editingMember?.id ?? generateId(),
      name: memberName,
      status: editingMember?.status ?? 'active',
      createdAt: editingMember?.createdAt ?? now,
      updatedAt: now,
    };
    setBusy('member');
    setFormError('');
    try {
      await saveMember(nextMember);
      setMemberModal(false);
    } catch (error) {
      setFormError(userFacingError(error));
    } finally {
      setBusy(null);
    }
  };

  const submitCrew = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const nextCrew: WorkCrew = {
      id: editingCrew?.id ?? generateId(),
      label: crewLabel,
      color: crewColor,
      memberIds: crewMemberIds,
      status: editingCrew?.status ?? 'active',
      createdAt: editingCrew?.createdAt ?? now,
      updatedAt: now,
    };
    setBusy('crew');
    setFormError('');
    try {
      await saveCrew(nextCrew);
      setCrewModal(false);
    } catch (error) {
      setFormError(userFacingError(error));
    } finally {
      setBusy(null);
    }
  };

  const changeMemberStatus = async (member: WorkforceMember) => {
    setBusy(`member:${member.id}`);
    setLoadFailure(null);
    try {
      await setMemberStatus(member.id, member.status === 'active' ? 'inactive' : 'active');
    } catch (error) {
      setLoadFailure({ key: loadKey, error: userFacingError(error) });
    } finally {
      setBusy(null);
    }
  };

  const changeCrewStatus = async (crew: WorkCrew) => {
    setBusy(`crew:${crew.id}`);
    setLoadFailure(null);
    try {
      await setCrewStatus(crew.id, crew.status === 'active' ? 'inactive' : 'active');
    } catch (error) {
      setLoadFailure({ key: loadKey, error: userFacingError(error) });
    } finally {
      setBusy(null);
    }
  };

  const toggleCrewMember = (memberId: string) => {
    setCrewMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  };

  const handleSaveDailyAssignments = async (
    projectId: string,
    dateKey: string,
    assignments: ProjectAssignment[],
  ) => {
    const override = await saveDailyAssignments(projectId, dateKey, assignments);
    if (!override) return;
    const current = getMemoryResource<ProjectTeamScheduleData>(scheduleResourceKey) ?? scheduleData;
    const next = {
      ...current,
      overridesByProjectDate: {
        ...current.overridesByProjectDate,
        [`${projectId}:${dateKey}`]: override,
      },
    };
    setScheduleData(next);
    setMemoryResource(scheduleResourceKey, next);
    if (uid)
      setMemoryResource(`private:${uid}:team-schedule:last`, {
        dateKeys: scheduleDateKeys,
        data: next,
      });
  };

  const handleResetDailyAssignments = async (projectId: string, dateKey: string) => {
    await removeDailyAssignmentOverride(projectId, dateKey);
    const current = getMemoryResource<ProjectTeamScheduleData>(scheduleResourceKey) ?? scheduleData;
    const overrides = { ...current.overridesByProjectDate };
    delete overrides[`${projectId}:${dateKey}`];
    const next = { ...current, overridesByProjectDate: overrides };
    setScheduleData(next);
    setMemoryResource(scheduleResourceKey, next);
    if (uid)
      setMemoryResource(`private:${uid}:team-schedule:last`, {
        dateKeys: scheduleDateKeys,
        data: next,
      });
  };

  const pageTitle = isManagementPage ? 'Gestionar equipo' : 'Equipo';
  const pageDescription = isNewWorkPage
    ? 'Programa un remate o ajuste y asigna quién se encargará.'
    : isManagementPage
      ? 'Registra a las personas de obra y agrúpalas en cuadrillas identificables.'
      : 'Organiza cada semana quién va a cada proyecto.';
  const pageTitleResolved = isNewWorkPage ? 'Nuevo trabajo' : pageTitle;
  const backToTeam = isManagementPage
    ? '/team'
    : isNewWorkPage
      ? `/team?date=${queryDateKey ?? initialDateKey}`
      : undefined;
  const pageActions = isNewWorkPage ? (
    <Button
      type="submit"
      form="team-job-form"
      className="shrink-0"
      aria-label="Guardar trabajo"
      loading={teamJobSaving}
      disabled={
        !members.some((member) => member.status === 'active') &&
        !crews.some((crew) => crew.status === 'active')
      }
    >
      Guardar
    </Button>
  ) : isManagementPage ? (
    <div className="flex shrink-0 gap-2">
      <Button
        variant="secondary"
        className="h-11 w-11 justify-center rounded-full p-0"
        aria-label="Crear cuadrilla"
        title="Crear cuadrilla"
        onClick={() => openCrew()}
      >
        <UsersRound size={18} aria-hidden="true" />
      </Button>
      <Button
        className="h-11 w-11 justify-center rounded-full p-0"
        aria-label="Añadir persona"
        title="Añadir persona"
        onClick={() => openMember()}
      >
        <CirclePlus size={18} aria-hidden="true" />
      </Button>
    </div>
  ) : (
    <Button
      variant="secondary"
      className="h-11 w-11 shrink-0 justify-center rounded-full p-0"
      aria-label="Gestionar miembros y cuadrillas"
      title="Gestionar miembros y cuadrillas"
      onClick={() => navigate('/team/manage')}
    >
      <Pencil size={18} aria-hidden="true" />
    </Button>
  );

  if (view && view !== 'manage' && view !== 'new-work') return <Navigate to="/team" replace />;

  if ((!loaded || !projectsLoaded) && !online) {
    return (
      <div className="page-container">
        <PageHeader
          title={pageTitleResolved}
          description={pageDescription}
          actions={isNewWorkPage ? undefined : pageActions}
          descriptionAndActionsBelowTitle={isManagementPage}
          backTo={backToTeam}
          backLabel="Volver a Equipo"
        />
        <OfflineUnavailable />
      </div>
    );
  }

  if ((!loaded || !projectsLoaded) && !loadError) {
    return (
      <div className="page-container" role="status" aria-label="Cargando equipo">
        <PageHeader
          title={pageTitleResolved}
          description={pageDescription}
          actions={isNewWorkPage ? undefined : pageActions}
          descriptionAndActionsBelowTitle={isManagementPage}
          backTo={backToTeam}
          backLabel="Volver a Equipo"
        />
        <div className="h-36 animate-pulse rounded-xl bg-white/70" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title={pageTitleResolved}
        description={pageDescription}
        actions={pageActions}
        actionsInWorkspaceHeader={isNewWorkPage}
        descriptionAndActionsBelowTitle={isManagementPage}
        backTo={backToTeam}
        backLabel="Volver a Equipo"
      />

      {loadError && (
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfb7a9] bg-[#fff8f4] px-4 py-3 text-sm text-[#743f31]"
          role="alert"
        >
          <span>{loadError}</span>
          <Button variant="secondary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Reintentar
          </Button>
        </div>
      )}

      <section aria-label="Planificación semanal" hidden={isManagementPage || isNewWorkPage}>
        <WeeklyProjectSchedule
          projects={projects}
          initialDateKeys={
            queryDateKey ? getWeekDateKeys(dateFromKey(queryDateKey)) : scheduleDateKeys
          }
          assignmentsByProjectId={visibleScheduleData.assignmentsByProjectId}
          overridesByProjectDate={visibleScheduleData.overridesByProjectDate}
          members={members}
          crews={crews}
          teamJobs={teamJobs}
          focusDateKey={isNewWorkPage ? undefined : queryDateKey}
          offline={!online}
          loading={scheduleLoading || jobsLoading}
          error={
            scheduleError ||
            jobsError ||
            (jobsUnavailable
              ? 'Esta semana aún no tiene trabajos cargados en esta sesión. Conéctate a internet para consultarlos.'
              : '') ||
            (scheduleUnavailable
              ? 'Esta semana aún no tiene datos cargados en esta sesión. Conéctate a internet para consultarla.'
              : '')
          }
          onRetry={() => {
            setScheduleAttempt((attempt) => attempt + 1);
            setJobsAttempt((attempt) => attempt + 1);
          }}
          onWeekDateKeysChange={setScheduleDateKeys}
          onNewJob={(dateKey) => navigate(`/team/jobs/new?date=${dateKey}`)}
          onSave={handleSaveDailyAssignments}
          onReset={handleResetDailyAssignments}
        />
      </section>

      <section aria-label="Nuevo trabajo" hidden={!isNewWorkPage}>
        {isNewWorkPage && (
          <NewTeamJobForm
            key={queryDateKey ?? initialDateKey}
            initialDate={queryDateKey ?? initialDateKey}
            members={members}
            crews={crews}
            projects={projects}
            onCreateMember={async (name) => {
              const now = new Date().toISOString();
              return saveMember({
                id: generateId(),
                name,
                status: 'active',
                createdAt: now,
                updatedAt: now,
              });
            }}
            onSavingChange={setTeamJobSaving}
            onSave={async (job) => {
              await createTeamJob(job);
              navigate(`/team?date=${job.date}`);
            }}
          />
        )}
      </section>

      <section aria-label="Gestión de personas y cuadrillas" hidden={!isManagementPage}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="team-members-title">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 id="team-members-title" className="text-xl font-semibold text-[#183e3b]">
                  Personas
                </h2>
                <p className="mt-1 text-sm text-[#637166]">
                  {activeMembers.length} activas de {members.length}
                </p>
              </div>
              <Button variant="ghost" className="shrink-0" onClick={() => openMember()}>
                <CirclePlus size={17} aria-hidden="true" />
                Añadir
              </Button>
            </div>

            {members.length === 0 ? (
              <Card className="border-dashed p-6 sm:p-8">
                <p className="font-medium text-[#253c34]">Empieza por registrar a tu equipo</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-[#637166]">
                  Añade a las personas que trabajan en tus obras. Después podrás agruparlas y
                  asignarlas a proyectos.
                </p>
                <Button className="mt-5 rounded-full" onClick={() => openMember()}>
                  Añadir primera persona
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <Card
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-semibold text-[#253c34]">{member.name}</h3>
                        <StatusBadge status={member.status} />
                      </div>
                      <p className="mt-1 text-xs text-[#637166]">
                        En {crews.filter((crew) => crew.memberIds.includes(member.id)).length}{' '}
                        cuadrillas
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        aria-label={`Editar a ${member.name}`}
                        onClick={() => openMember(member)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="secondary"
                        loading={busy === `member:${member.id}`}
                        aria-label={`${member.status === 'active' ? 'Desactivar' : 'Reactivar'} a ${member.name}`}
                        onClick={() => void changeMemberStatus(member)}
                      >
                        {member.status === 'active' ? 'Desactivar' : 'Reactivar'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="team-crews-title">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 id="team-crews-title" className="text-xl font-semibold text-[#183e3b]">
                  Cuadrillas
                </h2>
                <p className="mt-1 text-sm text-[#637166]">
                  Cada cuadrilla puede compartir integrantes con otras.
                </p>
              </div>
              <Button variant="ghost" className="shrink-0" onClick={() => openCrew()}>
                <CirclePlus size={17} aria-hidden="true" />
                Crear
              </Button>
            </div>

            {crews.length === 0 ? (
              <Card className="border-dashed p-6 sm:p-8">
                <p className="font-medium text-[#253c34]">Todavía no hay cuadrillas</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-[#637166]">
                  Ponles una etiqueta y un color para reconocerlas rápido al asignarlas a un
                  proyecto.
                </p>
                <Button
                  variant="secondary"
                  className="mt-5 rounded-full"
                  disabled={activeMembers.length === 0}
                  onClick={() => openCrew()}
                >
                  Crear cuadrilla
                </Button>
                {activeMembers.length === 0 && (
                  <p className="mt-3 text-xs text-[#637166]">Añade primero una persona activa.</p>
                )}
              </Card>
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
                    <Card key={crew.id} className="overflow-hidden">
                      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:px-5">
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
                          <p className="mt-2 text-sm leading-5 text-[#52625a]">
                            {crewMembers.map((member) => member.name).join(', ') ||
                              'Sin integrantes'}
                          </p>
                          {crewActiveCount === 0 ? (
                            <p className="mt-1 text-xs font-medium text-[#8a5418]">
                              Sin integrantes activos
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-[#637166]">
                              {crewActiveCount}{' '}
                              {crewActiveCount === 1 ? 'persona activa' : 'personas activas'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            aria-label={`Editar cuadrilla ${crew.label}`}
                            onClick={() => openCrew(crew)}
                          >
                            <Pencil size={16} aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="secondary"
                            loading={busy === `crew:${crew.id}`}
                            aria-label={`${crew.status === 'active' ? 'Desactivar' : 'Reactivar'} cuadrilla ${crew.label}`}
                            onClick={() => void changeCrewStatus(crew)}
                          >
                            {crew.status === 'active' ? 'Desactivar' : 'Reactivar'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>

      <Modal
        open={memberModal}
        onClose={() => setMemberModal(false)}
        title={editingMember ? 'Editar persona' : 'Añadir persona'}
      >
        <form onSubmit={(event) => void submitMember(event)} className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-[#183e3b]">
              {editingMember ? 'Editar persona' : 'Añadir persona'}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#637166]">
              Solo guardamos el nombre y si está activa en el equipo.
            </p>
          </div>
          <Input
            autoFocus
            id="workforce-member-name"
            label="Nombre"
            value={memberName}
            onChange={(event) => setMemberName(event.target.value)}
            maxLength={120}
            autoComplete="name"
            required
          />
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setMemberModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy === 'member'}>
              Guardar persona
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={crewModal}
        onClose={() => setCrewModal(false)}
        title={editingCrew ? 'Editar cuadrilla' : 'Crear cuadrilla'}
      >
        <form onSubmit={(event) => void submitCrew(event)} className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-[#183e3b]">
              {editingCrew ? 'Editar cuadrilla' : 'Crear cuadrilla'}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#637166]">
              Elige un nombre, un color y las personas que la forman.
            </p>
          </div>
          <Input
            autoFocus
            id="workforce-crew-label"
            label="Etiqueta"
            value={crewLabel}
            onChange={(event) => setCrewLabel(event.target.value)}
            maxLength={70}
            placeholder="Por ejemplo, Alba"
            required
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[#354b42]">Color</legend>
            <div className="grid grid-cols-4 gap-2">
              {CREW_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  aria-pressed={crewColor === color.value}
                  aria-label={`Color ${color.label}`}
                  onClick={() => setCrewColor(color.value)}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                    crewColor === color.value
                      ? 'border-[#183e3b] ring-2 ring-[#183e3b]/15'
                      : 'border-[#d0cbc0]'
                  }`}
                  style={{ backgroundColor: color.fill, color: color.ink }}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: color.dot }} />
                  {color.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[#354b42]">
              Personas <span className="font-normal text-[#637166]">({crewMemberIds.length})</span>
            </legend>
            {members.length === 0 ? (
              <p className="rounded-lg bg-[#f5f2eb] p-3 text-sm text-[#637166]">
                Añade una persona antes de crear una cuadrilla.
              </p>
            ) : (
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-[#e5e1d8] p-2">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-[#f5f2eb]"
                  >
                    <input
                      type="checkbox"
                      checked={crewMemberIds.includes(member.id)}
                      onChange={() => toggleCrewMember(member.id)}
                      className="size-4 accent-[#183e3b]"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-[#253c34]">
                      {member.name}
                    </span>
                    {member.status === 'inactive' && (
                      <span className="text-xs text-[#68756e]">Inactiva</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setCrewModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy === 'crew'}>
              <Check size={16} aria-hidden="true" />
              Guardar cuadrilla
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

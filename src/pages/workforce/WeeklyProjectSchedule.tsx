import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
  type ChangeEvent,
} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ListFilter,
  UsersRound,
} from 'lucide-react';
import {
  filterDailyProjectAssignments,
  findDailyScheduleConflicts,
  getEffectiveDayAssignments,
  getWeekDateKeys,
  isOnOrBeforeEstimatedEndDate,
} from '@/entities/project';
import type {
  Project,
  ProjectAssignment,
  ProjectDailyAssignmentOverride,
  DailyAssignmentResourceFilter,
} from '@/entities/project';
import type { WorkCrew, WorkforceMember } from '@/entities/workforce';
import { filterTeamJobsByResources } from '@/entities/workforce';
import type { TeamJob } from '@/entities/workforce';
import { Button, Card, PageLink } from '@/shared/ui';
import { colorFor } from './crewColors';
import { DailyProjectAssignmentsDialog } from './DailyProjectAssignmentsDialog';

interface WeeklyProjectScheduleProps {
  initialDateKeys?: string[];
  projects: Project[];
  assignmentsByProjectId: Record<string, ProjectAssignment[]>;
  overridesByProjectDate: Record<string, ProjectDailyAssignmentOverride>;
  members: WorkforceMember[];
  crews: WorkCrew[];
  teamJobs: TeamJob[];
  focusDateKey?: string;
  offline: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onWeekDateKeysChange: (dateKeys: string[]) => void;
  onNewJob: (dateKey: string) => void;
  onSave: (projectId: string, dateKey: string, assignments: ProjectAssignment[]) => Promise<void>;
  onReset: (projectId: string, dateKey: string) => Promise<void>;
}

type WeekSlideDirection = 'next' | 'previous';
type DayScheduleRows = Array<{
  project: Project;
  override?: ProjectDailyAssignmentOverride;
  assignments: ProjectAssignment[];
}>;
type DayScheduleRowsByDate = Record<string, DayScheduleRows>;

interface WeekSwipeState {
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  offset: number;
  direction: WeekSlideDirection | null;
  phase: 'dragging' | 'settling';
  commit: boolean;
  targetWeekStart: Date | null;
  targetSelectedDayIndex?: number;
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

function mondayOf(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function shiftWeek(date: Date, amount: -1 | 1) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount * 7, 12);
}

function formatWeekRange(dateKeys: string[]) {
  const start = dateFromKey(dateKeys[0]!);
  const end = dateFromKey(dateKeys[6]!);
  const dayFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric' });
  const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short' });
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const range = sameMonth
    ? `${dayFormatter.format(start)}–${dayFormatter.format(end)} ${monthFormatter.format(end).replace('.', '')}`
    : `${dayFormatter.format(start)} ${monthFormatter.format(start).replace('.', '')}–${dayFormatter.format(end)} ${monthFormatter.format(end).replace('.', '')}`;
  const year =
    start.getFullYear() === end.getFullYear()
      ? String(end.getFullYear())
      : `${start.getFullYear()}–${end.getFullYear()}`;
  return { range, year };
}

function formatDayLabel(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-ES', options).format(dateFromKey(dateKey));
}

function dayAssignments(
  dateKey: string,
  projects: Project[],
  assignmentsByProjectId: Record<string, ProjectAssignment[]>,
  overridesByProjectDate: Record<string, ProjectDailyAssignmentOverride>,
  selectedResources: DailyAssignmentResourceFilter[],
) {
  const rows = projects
    .filter(
      (project) =>
        isOnOrBeforeEstimatedEndDate(dateKey, project.estimatedEndDate) &&
        (project.status !== 'completed' ||
          Boolean(overridesByProjectDate[`${project.id}:${dateKey}`])),
    )
    .map((project) => {
      const override = overridesByProjectDate[`${project.id}:${dateKey}`];
      return {
        project,
        override,
        assignments: getEffectiveDayAssignments(
          project.status === 'completed' ? [] : (assignmentsByProjectId[project.id] ?? []),
          override,
        ),
      };
    });
  if (selectedResources.length === 0) return rows;
  return rows
    .map((row) => ({
      ...row,
      assignments: filterDailyProjectAssignments(row.assignments, selectedResources),
    }))
    .filter((row) => row.assignments.length > 0);
}

function ProjectDayCard({
  project,
  assignments,
  hasOverride,
  editable,
  onEdit,
  preview = false,
}: {
  project: Project;
  assignments: ProjectAssignment[];
  hasOverride: boolean;
  editable: boolean;
  onEdit: () => void;
  preview?: boolean;
}) {
  return (
    <article
      data-testid={preview ? undefined : `day-project-${project.id}`}
      className="rounded-xl border border-[#e2e5de] bg-white p-2.5 shadow-[0_1px_2px_rgba(31,49,41,0.04)]"
    >
      <div className="mb-2">
        <div className="min-w-0">
          <h4
            className="line-clamp-2 text-xs font-semibold leading-4 text-[#263a32]"
            title={project.title}
          >
            {project.title}
          </h4>
          {!project.estimatedEndDate && (
            <span className="text-[10px] font-medium text-[#8a5b20]">Sin fecha estimada</span>
          )}
          {hasOverride && (
            <span className="text-[10px] font-medium text-[#637166]">Plan editado</span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1">
          <button
            type="button"
            className="grid size-8 min-h-0 aspect-square place-items-center rounded-full border border-[#d8ddd4] bg-[#f7f8f4] p-0 text-[#24564c] hover:bg-[#edf2e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24564c] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Editar equipo de ${project.title}`}
            title={`Editar equipo de ${project.title}`}
            data-week-swipe-ignore
            disabled={!editable}
            onClick={onEdit}
          >
            <UsersRound size={16} aria-hidden="true" />
          </button>
          <PageLink
            to={`/projects/${project.id}`}
            className="grid size-8 aspect-square place-items-center rounded-full border border-[#d8ddd4] bg-[#f7f8f4] text-[#24564c] hover:bg-[#edf2e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24564c]"
            aria-label={`Ir al proyecto ${project.title}`}
            title={`Ir al proyecto ${project.title}`}
            data-week-swipe-ignore
          >
            <ArrowRight size={16} aria-hidden="true" />
          </PageLink>
        </div>
      </div>

      {assignments.length === 0 ? (
        <p className="rounded-lg bg-[#f5f6f1] px-2 py-2 text-[11px] leading-4 text-[#737e75]">
          Sin equipo asignado
        </p>
      ) : (
        <ul className="space-y-1.5">
          {assignments.map((assignment) => {
            if (assignment.resourceType === 'crew') {
              const crewColor = colorFor(assignment.color ?? 'blue');
              return (
                <li
                  key={assignment.id}
                  className="rounded-lg px-2 py-1.5 text-[11px] leading-4"
                  style={{ backgroundColor: crewColor.fill, color: crewColor.ink }}
                >
                  <p className="font-semibold">{assignment.label}</p>
                  {assignment.members.length > 0 && (
                    <p className="mt-0.5 break-words opacity-85">
                      {assignment.members.map((member) => member.name).join(', ')}
                    </p>
                  )}
                </li>
              );
            }
            return (
              <li
                key={assignment.id}
                className="rounded-lg bg-[#f0f2ed] px-2 py-1.5 text-[11px] font-medium leading-4 text-[#354b42]"
              >
                {assignment.label}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function TeamJobDayCard({ job, preview = false }: { job: TeamJob; preview?: boolean }) {
  return (
    <article
      data-testid={preview ? undefined : `day-job-${job.id}`}
      className="rounded-xl border border-[#e2e5de] bg-white p-2.5 shadow-[0_1px_2px_rgba(31,49,41,0.04)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-xs font-semibold leading-4 text-[#263a32]">
            {job.title}
          </h4>
          {job.projectTitle && (
            <p className="mt-0.5 text-[10px] font-medium text-[#637166]">{job.projectTitle}</p>
          )}
        </div>
        {job.projectId && (
          <PageLink
            to={`/projects/${job.projectId}`}
            className="grid size-8 shrink-0 aspect-square place-items-center rounded-full border border-[#d8ddd4] bg-[#f7f8f4] text-[#24564c] hover:bg-[#edf2e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24564c]"
            aria-label={`Ir al proyecto ${job.projectTitle ?? job.title}`}
            title={`Ir al proyecto ${job.projectTitle ?? job.title}`}
            data-week-swipe-ignore
          >
            <ArrowRight size={16} aria-hidden="true" />
          </PageLink>
        )}
      </div>
      {job.description && (
        <p className="mt-2 whitespace-pre-wrap text-[11px] leading-4 text-[#52625a]">
          {job.description}
        </p>
      )}
      <ul className="mt-2 space-y-1.5">
        {job.assignments.map((assignment) => {
          const crewColor =
            assignment.resourceType === 'crew' ? colorFor(assignment.color ?? 'blue') : null;
          return (
            <li
              key={assignment.id}
              className="rounded-lg px-2 py-1.5 text-[11px] leading-4"
              style={
                crewColor
                  ? { backgroundColor: crewColor.fill, color: crewColor.ink }
                  : { backgroundColor: '#f0f2ed', color: '#354b42' }
              }
            >
              <p className="font-semibold">{assignment.label}</p>
              {assignment.resourceType === 'crew' && assignment.members.length > 0 && (
                <p className="mt-0.5 break-words opacity-85">
                  {assignment.members.map((member) => member.name).join(', ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function WeeklyProjectSchedule({
  initialDateKeys,
  projects,
  assignmentsByProjectId,
  overridesByProjectDate,
  members,
  crews,
  teamJobs,
  focusDateKey,
  offline,
  loading,
  error,
  onRetry,
  onWeekDateKeysChange,
  onNewJob,
  onSave,
  onReset,
}: WeeklyProjectScheduleProps) {
  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(initialDateKeys?.[0] ? dateFromKey(initialDateKeys[0]) : new Date()),
  );
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    if (focusDateKey) return (dateFromKey(focusDateKey).getDay() + 6) % 7;
    return (new Date().getDay() + 6) % 7;
  });
  const [lastFocusDateKey, setLastFocusDateKey] = useState(focusDateKey);
  const [selectedResources, setSelectedResources] = useState<DailyAssignmentResourceFilter[]>([]);
  const resourceFilterRef = useRef<HTMLDetailsElement>(null);
  const [slideDirection, setSlideDirection] = useState<WeekSlideDirection | null>(null);
  const [swipe, setSwipe] = useState<WeekSwipeState | null>(null);
  const [editingProjectId, setEditingProjectId] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const swipeRef = useRef<WeekSwipeState | null>(null);
  const swipeSurfaceRef = useRef<HTMLDivElement | null>(null);
  const dateKeys = useMemo(() => getWeekDateKeys(weekStart), [weekStart]);
  const selectedDateKey = dateKeys[selectedDayIndex]!;
  const selectedProject = projects.find((project) => project.id === editingProjectId);
  const todayKey = getWeekDateKeys(new Date())[(new Date().getDay() + 6) % 7];
  const thisWeek = getWeekDateKeys(new Date());

  if (focusDateKey && focusDateKey !== lastFocusDateKey) {
    const focusedDate = dateFromKey(focusDateKey);
    setWeekStart(mondayOf(focusedDate));
    setSelectedDayIndex((focusedDate.getDay() + 6) % 7);
    setLastFocusDateKey(focusDateKey);
  } else if (!focusDateKey && lastFocusDateKey) {
    setLastFocusDateKey(undefined);
  }

  const updateSwipe = (next: WeekSwipeState | null) => {
    swipeRef.current = next;
    setSwipe(next);
  };

  useEffect(() => {
    onWeekDateKeysChange(dateKeys);
  }, [dateKeys, onWeekDateKeysChange]);

  const visibleProjects = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            project.status !== 'completed' ||
            dateKeys.some((dateKey) => overridesByProjectDate[`${project.id}:${dateKey}`]),
        )
        .sort((a, b) => a.title.localeCompare(b.title, 'es')),
    [projects, dateKeys, overridesByProjectDate],
  );
  const memberOptions = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [members],
  );
  const crewOptions = useMemo(
    () => [...crews].sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [crews],
  );
  const rowsByDate = useMemo(
    () =>
      Object.fromEntries(
        dateKeys.map((dateKey) => [
          dateKey,
          dayAssignments(
            dateKey,
            visibleProjects,
            assignmentsByProjectId,
            overridesByProjectDate,
            selectedResources,
          ),
        ]),
      ),
    [dateKeys, visibleProjects, assignmentsByProjectId, overridesByProjectDate, selectedResources],
  );
  const filteredTeamJobs = useMemo(
    () => filterTeamJobsByResources(teamJobs, selectedResources),
    [teamJobs, selectedResources],
  );
  const jobsByDate = useMemo(
    () =>
      Object.fromEntries(
        dateKeys.map((dateKey) => [
          dateKey,
          filteredTeamJobs.filter((job) => job.date === dateKey),
        ]),
      ),
    [dateKeys, filteredTeamJobs],
  );
  const swipeDirection = swipe?.direction ?? null;
  const targetWeekStart = swipe?.targetWeekStart ?? null;
  const previewDateKeys = useMemo(() => {
    if (!swipeDirection) return [];
    const previewStart =
      targetWeekStart ?? shiftWeek(weekStart, swipeDirection === 'next' ? 1 : -1);
    return getWeekDateKeys(previewStart);
  }, [swipeDirection, targetWeekStart, weekStart]);
  const previewProjects = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            project.status !== 'completed' ||
            previewDateKeys.some((dateKey) => overridesByProjectDate[`${project.id}:${dateKey}`]),
        )
        .sort((a, b) => a.title.localeCompare(b.title, 'es')),
    [projects, previewDateKeys, overridesByProjectDate],
  );
  const previewRowsByDate = useMemo<DayScheduleRowsByDate>(
    () =>
      Object.fromEntries(
        previewDateKeys.map((dateKey) => [
          dateKey,
          dayAssignments(
            dateKey,
            previewProjects,
            assignmentsByProjectId,
            overridesByProjectDate,
            selectedResources,
          ),
        ]),
      ),
    [
      previewDateKeys,
      previewProjects,
      assignmentsByProjectId,
      overridesByProjectDate,
      selectedResources,
    ],
  );
  const previewJobsByDate = useMemo(
    () =>
      Object.fromEntries(
        previewDateKeys.map((dateKey) => [
          dateKey,
          filteredTeamJobs.filter((job) => job.date === dateKey),
        ]),
      ),
    [previewDateKeys, filteredTeamJobs],
  );
  const toggleResourceFilter = (resource: DailyAssignmentResourceFilter) => {
    setSelectedResources((current) => {
      const exists = current.some(
        (selected) => selected.type === resource.type && selected.id === resource.id,
      );
      return exists
        ? current.filter(
            (selected) => selected.type !== resource.type || selected.id !== resource.id,
          )
        : [...current, resource];
    });
  };

  const isResourceSelected = (resource: DailyAssignmentResourceFilter) =>
    selectedResources.some(
      (selected) => selected.type === resource.type && selected.id === resource.id,
    );

  const finishSwipe = (state: WeekSwipeState) => {
    if (state.commit && state.targetWeekStart) {
      setSlideDirection(state.direction);
      setWeekStart(state.targetWeekStart);
      if (state.targetSelectedDayIndex !== undefined)
        setSelectedDayIndex(state.targetSelectedDayIndex);
    }
    updateSwipe(null);
  };

  const startWeekSlide = (
    targetWeekStart: Date,
    direction: WeekSlideDirection,
    targetSelectedDayIndex?: number,
  ) => {
    const width = swipeSurfaceRef.current?.clientWidth ?? 0;
    setSlideDirection(direction);
    if (width === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setWeekStart(targetWeekStart);
      if (targetSelectedDayIndex !== undefined) setSelectedDayIndex(targetSelectedDayIndex);
      return;
    }

    const initial: WeekSwipeState = {
      pointerId: -1,
      startX: 0,
      startY: 0,
      width,
      offset: 0,
      direction,
      phase: 'dragging',
      commit: true,
      targetWeekStart,
      targetSelectedDayIndex,
    };
    updateSwipe(initial);
    requestAnimationFrame(() => {
      const current = swipeRef.current;
      if (!current || current.pointerId !== -1) return;
      updateSwipe({
        ...current,
        phase: 'settling',
        offset: direction === 'next' ? -width : width,
      });
    });
  };

  const changeWeek = (amount: -1 | 1) => {
    if (offline || swipeRef.current) return;
    startWeekSlide(shiftWeek(weekStart, amount), amount === 1 ? 'next' : 'previous');
  };

  const showCurrentWeek = () => {
    const today = new Date();
    const currentWeekStart = mondayOf(today);
    const todayIndex = (today.getDay() + 6) % 7;
    if (offline || currentWeekStart.getTime() === weekStart.getTime()) {
      setSelectedDayIndex(todayIndex);
      return;
    }
    if (swipeRef.current) return;
    startWeekSlide(
      currentWeekStart,
      currentWeekStart > weekStart ? 'next' : 'previous',
      todayIndex,
    );
  };

  const selectWeekDate = (event: ChangeEvent<HTMLInputElement>) => {
    if (offline || swipeRef.current || !event.currentTarget.value) return;
    const selectedDate = dateFromKey(event.currentTarget.value);
    const targetWeekStart = mondayOf(selectedDate);
    const targetDayIndex = (selectedDate.getDay() + 6) % 7;
    if (targetWeekStart.getTime() === weekStart.getTime()) {
      setSelectedDayIndex(targetDayIndex);
      return;
    }
    startWeekSlide(
      targetWeekStart,
      targetWeekStart > weekStart ? 'next' : 'previous',
      targetDayIndex,
    );
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (offline || !event.isPrimary || event.button !== 0 || swipeRef.current) return;
    if (event.target instanceof Element && event.target.closest('[data-week-swipe-ignore]')) return;
    const width = event.currentTarget.clientWidth;
    if (width === 0) return;
    updateSwipe({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width,
      offset: 0,
      direction: null,
      phase: 'dragging',
      commit: false,
      targetWeekStart: null,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = swipeRef.current;
    if (
      !current ||
      current.pointerId !== event.pointerId ||
      current.phase !== 'dragging' ||
      current.pointerId === -1
    )
      return;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (!current.direction && Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
    if (!current.direction && Math.abs(deltaY) > Math.abs(deltaX)) {
      updateSwipe(null);
      return;
    }
    if (Math.abs(deltaX) < 8) return;
    event.preventDefault();
    if (!event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.setPointerCapture(event.pointerId);
    const direction = deltaX < 0 ? 'next' : 'previous';
    updateSwipe({ ...current, direction, offset: deltaX });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = swipeRef.current;
    if (
      !current ||
      current.pointerId !== event.pointerId ||
      current.pointerId === -1 ||
      current.phase !== 'dragging'
    )
      return;
    if (!current.direction) {
      updateSwipe(null);
      return;
    }
    const threshold = Math.max(56, Math.min(120, current.width * 0.22));
    const commit = Math.abs(current.offset) >= threshold;
    const amount = current.direction === 'next' ? 1 : -1;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateSwipe(null);
      if (commit) {
        setSlideDirection(current.direction);
        setWeekStart(shiftWeek(weekStart, amount));
      }
      return;
    }
    updateSwipe({
      ...current,
      phase: 'settling',
      commit,
      targetWeekStart: commit ? shiftWeek(weekStart, amount) : null,
      offset: commit ? (current.direction === 'next' ? -current.width : current.width) : 0,
    });
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = swipeRef.current;
    if (!current || current.pointerId !== event.pointerId || current.pointerId === -1) return;
    updateSwipe(null);
  };

  const handleSlideTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    const current = swipeRef.current;
    if (!current || current.phase !== 'settling') return;
    finishSwipe(current);
  };

  const handleSave = async (
    dateKey: string,
    projectId: string,
    assignments: ProjectAssignment[],
  ) => {
    const key = `${dateKey}:${projectId}`;
    setSavingKey(key);
    try {
      await onSave(projectId, dateKey, assignments);
      setEditingProjectId('');
    } finally {
      setSavingKey('');
    }
  };

  const handleReset = async (dateKey: string, projectId: string) => {
    const key = `${dateKey}:${projectId}`;
    setSavingKey(key);
    try {
      await onReset(projectId, dateKey);
      setEditingProjectId('');
    } finally {
      setSavingKey('');
    }
  };

  const dayCount = (
    dateKey: string,
    scheduleRows: DayScheduleRowsByDate,
    jobsByDay: Record<string, TeamJob[]>,
  ) => {
    const rows = scheduleRows[dateKey] ?? [];
    return (
      rows.filter((row) => row.assignments.length > 0).length + (jobsByDay[dateKey]?.length ?? 0)
    );
  };

  const renderDay = (
    dateKey: string,
    index: number,
    compact: boolean,
    scheduleRows: DayScheduleRowsByDate,
    jobsByDay: Record<string, TeamJob[]>,
    preview: boolean,
  ) => {
    const rows = scheduleRows[dateKey] ?? [];
    const jobs = jobsByDay[dateKey] ?? [];
    const selected = index === selectedDayIndex;
    const dayConflicts = findDailyScheduleConflicts([
      ...rows.map(({ project, assignments }) => ({
        id: `project:${project.id}`,
        title: project.title,
        assignments,
      })),
      ...jobs.map((job) => ({
        id: `job:${job.id}`,
        title: job.title,
        assignments: job.assignments,
      })),
    ]);
    return (
      <section
        key={dateKey}
        data-week-day={compact || preview ? undefined : dateKey}
        className={`min-w-0 rounded-2xl ${compact ? '' : 'border border-[#e3e7e0] bg-[#f8f9f5] p-2'}`}
        aria-label={formatDayLabel(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}
      >
        {!compact && (
          <button
            type="button"
            className={`mb-2 w-full rounded-xl px-2 py-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24564c] ${selected ? 'bg-[#e6eee6]' : 'hover:bg-white'}`}
            aria-pressed={!preview && selected}
            onClick={preview ? undefined : () => setSelectedDayIndex(index)}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6a766c]">
              {formatDayLabel(dateKey, { weekday: 'short' }).replace('.', '')}
            </span>
            <span className="mt-0.5 block text-lg font-semibold text-[#203a32]">
              {formatDayLabel(dateKey, { day: 'numeric' })}
            </span>
          </button>
        )}
        {compact && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h3 className="text-lg font-semibold text-[#203a32]">
                {formatDayLabel(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              {dateKey === todayKey && (
                <span className="text-xs font-semibold text-[#367760]">Hoy</span>
              )}
            </div>
            {!preview && (
              <button
                type="button"
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-[#24564c] hover:bg-[#edf2e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#24564c]"
                aria-label="Nuevo trabajo"
                title={`Nuevo trabajo · ${formatDayLabel(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                data-week-swipe-ignore
                onClick={() => onNewJob(dateKey)}
              >
                <CirclePlus size={15} aria-hidden="true" />
                Nuevo trabajo
              </button>
            )}
          </div>
        )}
        {!compact && !preview && (
          <button
            type="button"
            className="mb-2 inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-[#24564c] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#24564c]"
            aria-label="Nuevo trabajo"
            title={`Nuevo trabajo · ${formatDayLabel(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}`}
            data-week-swipe-ignore
            onClick={() => onNewJob(dateKey)}
          >
            <CirclePlus size={15} aria-hidden="true" />
            Nuevo trabajo
          </button>
        )}
        {dayConflicts.length > 0 && selected && (
          <div
            className="mb-2 rounded-lg border border-[#efd7a9] bg-[#fff7e8] px-2 py-2 text-[11px] leading-4 text-[#704811]"
            role={preview ? undefined : 'alert'}
          >
            {dayConflicts.map((conflict) => (
              <p key={conflict.memberId}>
                <AlertTriangle className="mr-1 inline-block" size={13} aria-hidden="true" />
                <strong>Conflicto:</strong> {conflict.memberName} figura en{' '}
                {conflict.items.map((item) => item.title).join(' y ')}.
              </p>
            ))}
          </div>
        )}
        {rows.length === 0 && jobs.length === 0 ? (
          <Card className="border-dashed p-4 text-center text-xs leading-5 text-[#637166]">
            {selectedResources.length > 0
              ? 'No hay asignaciones de este equipo para este día.'
              : 'No hay proyectos ni trabajos puntuales para este día.'}
          </Card>
        ) : (
          <div className={compact ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>
            {rows.map(({ project, assignments, override }) => (
              <ProjectDayCard
                key={project.id}
                project={project}
                assignments={assignments}
                hasOverride={Boolean(override)}
                editable={!preview && project.status !== 'completed'}
                preview={preview}
                onEdit={() => {
                  if (preview) return;
                  setSelectedDayIndex(index);
                  setEditingProjectId(project.id);
                }}
              />
            ))}
            {jobs.map((job) => (
              <TeamJobDayCard key={job.id} job={job} preview={preview} />
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderWeek = (
    weekDateKeys: string[],
    scheduleRows: DayScheduleRowsByDate,
    jobsByDay: Record<string, TeamJob[]>,
    preview: boolean,
  ) => {
    const selectedWeekDateKey = weekDateKeys[selectedDayIndex]!;
    const { range: weekRange, year: weekYear } = formatWeekRange(weekDateKeys);
    const isWeekCurrent = weekDateKeys[0] === thisWeek[0];
    return (
      <div className="space-y-3">
        <div data-testid="week-selector" className="space-y-1">
          <div className="flex min-h-11 items-center justify-between gap-1">
            <label className="relative flex min-w-0 flex-1 cursor-pointer items-center focus-within:rounded-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#24564c]">
              <h2
                data-testid="week-range"
                className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold leading-tight text-[#252c26] sm:text-base"
              >
                {weekRange} · {weekYear}
              </h2>
              <input
                type="date"
                data-testid="week-date-picker"
                aria-label="Elegir semana por fecha"
                data-week-swipe-ignore
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={selectedWeekDateKey}
                disabled={offline || preview}
                onChange={selectWeekDate}
              />
            </label>
            <div
              data-testid="week-selector-controls"
              className="flex shrink-0 items-center gap-0.5"
            >
              <Button
                variant="ghost"
                className="size-11 shrink-0 justify-center rounded-full bg-transparent p-0 text-[#354b42] hover:bg-[#eef1eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#24564c]"
                aria-label="Semana anterior"
                title="Semana anterior"
                disabled={offline}
                onClick={() => changeWeek(-1)}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                className="min-h-9 shrink-0 rounded-lg px-1.5 py-0 text-[11px] text-[#354b42] hover:bg-[#eef1eb] sm:min-h-10 sm:px-2 sm:text-xs"
                aria-label="Esta semana"
                onClick={showCurrentWeek}
                disabled={offline || (isWeekCurrent && selectedWeekDateKey === todayKey)}
              >
                <span className="sm:hidden">Hoy</span>
                <span className="hidden sm:inline">Esta semana</span>
              </Button>
              <Button
                variant="ghost"
                className="size-11 shrink-0 justify-center rounded-full bg-transparent p-0 text-[#354b42] hover:bg-[#eef1eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#24564c]"
                aria-label="Semana siguiente"
                title="Semana siguiente"
                disabled={offline}
                onClick={() => changeWeek(1)}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-y border-[#e3e1d9] py-1">
            {weekDateKeys.map((dateKey, index) => {
              const count = dayCount(dateKey, scheduleRows, jobsByDay);
              const selected = index === selectedDayIndex;
              return (
                <button
                  key={dateKey}
                  type="button"
                  data-day-key={preview ? undefined : dateKey}
                  className="flex min-h-[58px] flex-col items-center justify-center rounded-xl bg-transparent px-0.5 py-1 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#24564c]"
                  aria-label={formatDayLabel(dateKey, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  aria-pressed={!preview && selected}
                  aria-current={!preview && dateKey === todayKey ? 'date' : undefined}
                  onClick={preview ? undefined : () => setSelectedDayIndex(index)}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#626e65]">
                    {formatDayLabel(dateKey, { weekday: 'short' }).replace('.', '')}
                  </span>
                  <span
                    data-testid="week-day-number"
                    className={`mt-0.5 grid size-7 place-items-center rounded-full text-sm ${selected ? 'bg-[#561321] font-semibold text-white' : dateKey === todayKey ? 'font-bold text-[#561321]' : 'text-[#26342d]'}`}
                  >
                    {formatDayLabel(dateKey, { day: 'numeric' })}
                  </span>
                  <span
                    data-testid="week-day-dots"
                    className="mt-0.5 flex h-1.5 items-center gap-1"
                    aria-hidden="true"
                  >
                    {Array.from({ length: Math.min(count, 3) }, (_, dot) => (
                      <span key={dot} className="size-1.5 rounded-full bg-[#436986]" />
                    ))}
                  </span>
                  <span className="sr-only">{count} asignaciones programadas</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div
            className="grid min-h-40 animate-pulse grid-cols-1 gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2 xl:grid-cols-7"
            role={preview ? undefined : 'status'}
            aria-label={preview ? undefined : 'Cargando planificación semanal'}
          />
        ) : error ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfb7a9] bg-[#fff8f4] px-4 py-3 text-sm text-[#743f31]"
            role={preview ? undefined : 'alert'}
          >
            <span>{error}</span>
            {!preview && (
              <Button variant="secondary" onClick={onRetry}>
                Reintentar
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden gap-3 xl:grid xl:grid-cols-7">
              {weekDateKeys.map((dateKey, index) =>
                renderDay(dateKey, index, false, scheduleRows, jobsByDay, preview),
              )}
            </div>
            <div className="xl:hidden">
              {renderDay(
                selectedWeekDateKey,
                selectedDayIndex,
                true,
                scheduleRows,
                jobsByDay,
                preview,
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const activeOverride = selectedProject
    ? overridesByProjectDate[`${selectedProject.id}:${selectedDateKey}`]
    : undefined;
  const defaults = selectedProject ? (assignmentsByProjectId[selectedProject.id] ?? []) : [];
  const currentAssignments = selectedProject
    ? getEffectiveDayAssignments(
        selectedProject.status === 'completed' ? [] : defaults,
        activeOverride,
      )
    : [];

  useEffect(() => {
    const dismissResourceFilter = (event: PointerEvent) => {
      const filter = resourceFilterRef.current;
      if (filter?.open && !filter.contains(event.target as Node)) filter.open = false;
    };
    document.addEventListener('pointerdown', dismissResourceFilter);
    return () => document.removeEventListener('pointerdown', dismissResourceFilter);
  }, []);

  return (
    <section aria-label="Planificación semanal de proyectos" className="space-y-3">
      <div className="flex justify-end">
        <details
          ref={resourceFilterRef}
          className="relative z-30 w-full sm:w-auto"
          data-testid="weekly-resource-filter"
        >
          <summary className="ml-auto flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-[#dce2dc] bg-white px-3 text-sm font-semibold text-[#354b42] shadow-sm hover:bg-[#f7f8f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24564c] [&::-webkit-details-marker]:hidden">
            <ListFilter size={16} aria-hidden="true" />
            <span>Filtrar equipo</span>
            <span className="rounded-full bg-[#eef1eb] px-2 py-0.5 text-xs text-[#52625a]">
              {selectedResources.length === 0 ? 'Todos' : selectedResources.length}
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.5rem)] max-h-[min(28rem,55dvh)] w-[min(20rem,calc(100vw_-_2.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-[#dce2dc] bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs leading-4 text-[#667168]">
                Coincide con cualquiera de los recursos.
              </p>
              {selectedResources.length > 0 && (
                <button
                  type="button"
                  aria-label="Limpiar filtros"
                  className="shrink-0 rounded px-1 py-1 text-xs font-semibold text-[#24564c] hover:text-[#183e3b]"
                  onClick={() => setSelectedResources([])}
                >
                  Limpiar
                </button>
              )}
            </div>
            {memberOptions.length > 0 && (
              <fieldset className="space-y-0.5">
                <legend className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[#637166]">
                  Miembros
                </legend>
                {memberOptions.map((member) => {
                  const resource = { type: 'member' as const, id: member.id };
                  return (
                    <label
                      key={member.id}
                      className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm text-[#354b42] hover:bg-[#f5f7f2]"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[#24564c]"
                        aria-label={`Mostrar asignaciones de ${member.name}`}
                        checked={isResourceSelected(resource)}
                        onChange={() => toggleResourceFilter(resource)}
                      />
                      <span className="min-w-0 flex-1 truncate">{member.name}</span>
                      {member.status === 'inactive' && (
                        <span className="text-[10px] text-[#778078]">Inactivo</span>
                      )}
                    </label>
                  );
                })}
              </fieldset>
            )}
            {crewOptions.length > 0 && (
              <fieldset
                className={`${memberOptions.length > 0 ? 'mt-2 border-t border-[#edf0eb] pt-2' : ''} space-y-0.5`}
              >
                <legend className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[#637166]">
                  Cuadrillas
                </legend>
                {crewOptions.map((crew) => {
                  const resource = { type: 'crew' as const, id: crew.id };
                  return (
                    <label
                      key={crew.id}
                      className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm text-[#354b42] hover:bg-[#f5f7f2]"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[#24564c]"
                        aria-label={`Mostrar asignaciones de cuadrilla ${crew.label}`}
                        checked={isResourceSelected(resource)}
                        onChange={() => toggleResourceFilter(resource)}
                      />
                      <span className="min-w-0 flex-1 truncate">{crew.label}</span>
                      {crew.status === 'inactive' && (
                        <span className="text-[10px] text-[#778078]">Inactiva</span>
                      )}
                    </label>
                  );
                })}
              </fieldset>
            )}
          </div>
        </details>
      </div>

      <div className="overflow-x-clip">
        <div
          ref={swipeSurfaceRef}
          className="weekly-swipe-surface touch-pan-y"
          data-testid="weekly-swipe-surface"
          data-slide-direction={swipe?.direction ?? slideDirection ?? 'none'}
          data-swipe-phase={swipe?.phase ?? 'idle'}
          data-drag-offset={swipe?.offset ?? 0}
          data-dragging={Boolean(swipe?.direction && swipe.phase === 'dragging')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div className="relative grid items-start overflow-x-clip">
            <div
              data-week-slide="current"
              className="weekly-week-slide col-start-1 row-start-1 min-w-0"
              data-settling={swipe?.phase === 'settling'}
              onTransitionEnd={handleSlideTransitionEnd}
              style={{
                transform: `translate3d(${swipe?.offset ?? 0}px, 0, 0)`,
                transition:
                  swipe?.phase === 'settling'
                    ? 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)'
                    : 'none',
              }}
            >
              {renderWeek(dateKeys, rowsByDate, jobsByDate, false)}
            </div>
            {swipe?.direction && previewDateKeys.length === 7 && (
              <div
                data-week-slide="preview"
                className="weekly-week-slide pointer-events-none col-start-1 row-start-1 min-w-0"
                data-settling={swipe.phase === 'settling'}
                aria-hidden="true"
                inert
                style={{
                  transform: `translate3d(${(swipe.direction === 'next' ? swipe.width : -swipe.width) + swipe.offset}px, 0, 0)`,
                  transition:
                    swipe.phase === 'settling'
                      ? 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)'
                      : 'none',
                }}
              >
                {renderWeek(previewDateKeys, previewRowsByDate, previewJobsByDate, true)}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedProject && (
        <DailyProjectAssignmentsDialog
          key={`${selectedProject.id}:${selectedDateKey}`}
          project={selectedProject}
          dateLabel={formatDayLabel(selectedDateKey, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          members={members}
          crews={crews}
          assignments={currentAssignments}
          hasOverride={Boolean(activeOverride)}
          saving={savingKey === `${selectedDateKey}:${selectedProject.id}`}
          onClose={() => setEditingProjectId('')}
          onSave={(assignments) => handleSave(selectedDateKey, selectedProject.id, assignments)}
          onReset={() => handleReset(selectedDateKey, selectedProject.id)}
        />
      )}
    </section>
  );
}

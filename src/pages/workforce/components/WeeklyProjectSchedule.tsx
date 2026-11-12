import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  getEffectiveDayAssignments,
  getWeekDateKeys,
  type DailyAssignmentResourceFilter,
  type Project,
  type ProjectAssignment,
  type ProjectDailyAssignmentOverride,
} from '@/entities/project';
import type { TeamJob, WorkCrew, WorkforceMember } from '@/entities/workforce';
import { dateFromKey, shiftWeeks, startOfWeek, todayKey as getTodayKey } from '@/shared/lib';
import type { DateKey } from '@/shared/lib';
import { Alert, Button } from '@/shared/ui';
import {
  buildWeekSchedule,
  formatLongDay,
  weekdayIndex,
  type WeekScheduleData,
} from '../model/schedule';
import { useWeekSwipe } from '../model/useWeekSwipe';
import { TEAM_COPY } from '../model/copy';
import { DailyProjectAssignmentsDialog } from './DailyProjectAssignmentsDialog';
import { DaySchedule } from './DaySchedule';
import { ResourceFilterPopover } from './ResourceFilterPopover';
import { WeekHeader } from './WeekHeader';

interface WeeklyProjectScheduleProps {
  weekStart: Date;
  selectedDayIndex: number;
  selectedResources: DailyAssignmentResourceFilter[];
  onWeekChange: (weekStart: Date, selectedDayIndex?: number) => void;
  onSelectedDayChange: (index: number) => void;
  onSelectedResourcesChange: (resources: DailyAssignmentResourceFilter[]) => void;
  projects: Project[];
  assignmentsByProjectId: Record<string, ProjectAssignment[]>;
  overridesByProjectDate: Record<string, ProjectDailyAssignmentOverride>;
  members: WorkforceMember[];
  crews: WorkCrew[];
  teamJobs: TeamJob[];
  offline: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onNewJob: (dateKey: DateKey) => void;
  onSave: (projectId: string, dateKey: DateKey, assignments: ProjectAssignment[]) => Promise<void>;
  onReset: (projectId: string, dateKey: DateKey) => Promise<void>;
}

/** Weekly team calendar: seven columns on desktop, one selected day below `xl`. */
export function WeeklyProjectSchedule({
  weekStart,
  selectedDayIndex,
  selectedResources,
  onWeekChange,
  onSelectedDayChange,
  onSelectedResourcesChange,
  projects,
  assignmentsByProjectId,
  overridesByProjectDate,
  members,
  crews,
  teamJobs,
  offline,
  loading,
  error,
  onRetry,
  onNewJob,
  onSave,
  onReset,
}: WeeklyProjectScheduleProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [editingProjectId, setEditingProjectId] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const { swipe, slideDirection, slideTo, isSliding, slideStyle, handlers, onTransitionEnd } =
    useWeekSwipe({ surfaceRef, weekStart, disabled: offline, onCommit: onWeekChange });

  const dateKeys = useMemo(() => getWeekDateKeys(weekStart), [weekStart]);
  const selectedDateKey = dateKeys[selectedDayIndex]!;
  const todayKey = getTodayKey();
  const currentWeekStartKey = getWeekDateKeys(new Date())[0];
  const source = useMemo(
    () => ({
      projects,
      assignmentsByProjectId,
      overridesByProjectDate,
      teamJobs,
      selectedResources,
    }),
    [projects, assignmentsByProjectId, overridesByProjectDate, teamJobs, selectedResources],
  );
  const week = useMemo(() => buildWeekSchedule(dateKeys, source), [dateKeys, source]);
  const swipeDirection = swipe?.direction ?? null;
  const swipeTarget = swipe?.targetWeekStart ?? null;
  const previewDateKeys = useMemo(() => {
    if (!swipeDirection) return [];
    return getWeekDateKeys(
      swipeTarget ?? shiftWeeks(weekStart, swipeDirection === 'next' ? 1 : -1),
    );
  }, [swipeDirection, swipeTarget, weekStart]);
  const previewWeek = useMemo(
    () => (previewDateKeys.length ? buildWeekSchedule(previewDateKeys, source) : null),
    [previewDateKeys, source],
  );

  const changeWeek = (amount: -1 | 1) => {
    if (offline) return;
    slideTo(shiftWeeks(weekStart, amount), amount === 1 ? 'next' : 'previous');
  };

  const showToday = () => {
    const today = new Date();
    const target = startOfWeek(today);
    const todayIndex = weekdayIndex(today);
    if (offline || target.getTime() === weekStart.getTime()) {
      onSelectedDayChange(todayIndex);
      return;
    }
    slideTo(target, target > weekStart ? 'next' : 'previous', todayIndex);
  };

  const pickDate = (event: ChangeEvent<HTMLInputElement>) => {
    if (offline || isSliding() || !event.currentTarget.value) return;
    const date = dateFromKey(event.currentTarget.value);
    const target = startOfWeek(date);
    if (target.getTime() === weekStart.getTime()) {
      onSelectedDayChange(weekdayIndex(date));
      return;
    }
    slideTo(target, target > weekStart ? 'next' : 'previous', weekdayIndex(date));
  };

  const runSave = async (operation: () => Promise<void>) => {
    if (!editingProjectId) return;
    setSavingKey(`${selectedDateKey}:${editingProjectId}`);
    try {
      await operation();
      setEditingProjectId('');
    } finally {
      setSavingKey('');
    }
  };

  const renderWeek = (weekDateKeys: DateKey[], data: WeekScheduleData, preview: boolean) => {
    const dayKey = weekDateKeys[selectedDayIndex]!;
    const day = (dateKey: DateKey, index: number, compact: boolean) => (
      <DaySchedule
        key={dateKey}
        dateKey={dateKey}
        rows={data.rowsByDate[dateKey] ?? []}
        jobs={data.jobsByDate[dateKey] ?? []}
        compact={compact}
        preview={preview}
        selected={index === selectedDayIndex}
        isToday={dateKey === todayKey}
        filtered={selectedResources.length > 0}
        onSelect={() => onSelectedDayChange(index)}
        onNewJob={() => onNewJob(dateKey)}
        onEditProject={(projectId) => {
          onSelectedDayChange(index);
          setEditingProjectId(projectId);
        }}
      />
    );
    return (
      <div className="space-y-3">
        <WeekHeader
          dateKeys={weekDateKeys}
          week={data}
          selectedDayIndex={selectedDayIndex}
          todayKey={todayKey}
          isCurrentWeek={weekDateKeys[0] === currentWeekStartKey}
          offline={offline}
          preview={preview}
          onPreviousWeek={() => changeWeek(-1)}
          onNextWeek={() => changeWeek(1)}
          onToday={showToday}
          onPickDate={pickDate}
          onSelectDay={onSelectedDayChange}
        />
        {loading ? (
          <div
            className="grid min-h-40 animate-pulse grid-cols-1 gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-2 xl:grid-cols-7"
            role={preview ? undefined : 'status'}
            aria-label={preview ? undefined : 'Cargando planificación semanal'}
          />
        ) : error ? (
          <Alert
            tone="danger"
            plain
            role={preview ? 'none' : 'alert'}
            action={
              !preview && (
                <Button variant="secondary" onClick={onRetry}>
                  {TEAM_COPY.retry}
                </Button>
              )
            }
          >
            {error}
          </Alert>
        ) : (
          <>
            <div className="hidden gap-3 xl:grid xl:grid-cols-7">
              {weekDateKeys.map((dateKey, index) => day(dateKey, index, false))}
            </div>
            <div className="xl:hidden">{day(dayKey, selectedDayIndex, true)}</div>
          </>
        )}
      </div>
    );
  };

  const selectedProject = projects.find((project) => project.id === editingProjectId);
  const activeOverride = selectedProject
    ? overridesByProjectDate[`${selectedProject.id}:${selectedDateKey}`]
    : undefined;
  const currentAssignments = selectedProject
    ? getEffectiveDayAssignments(
        selectedProject.status === 'completed'
          ? []
          : (assignmentsByProjectId[selectedProject.id] ?? []),
        activeOverride,
      )
    : [];

  return (
    <section aria-label="Planificación semanal de proyectos" className="space-y-3">
      <div className="flex justify-end">
        <ResourceFilterPopover
          members={members}
          crews={crews}
          selected={selectedResources}
          onChange={onSelectedResourcesChange}
        />
      </div>

      <div className="overflow-x-clip">
        <div
          ref={surfaceRef}
          className="swipe-surface touch-pan-y"
          data-testid="weekly-swipe-surface"
          data-slide-direction={swipe?.direction ?? slideDirection ?? 'none'}
          data-swipe-phase={swipe?.phase ?? 'idle'}
          data-drag-offset={swipe?.offset ?? 0}
          data-dragging={Boolean(swipe?.direction && swipe.phase === 'dragging')}
          {...handlers}
        >
          <div className="relative grid items-start overflow-x-clip">
            <div
              data-week-slide="current"
              className="col-start-1 row-start-1 min-w-0"
              data-settling={swipe?.phase === 'settling'}
              onTransitionEnd={onTransitionEnd}
              style={slideStyle(false)}
            >
              {renderWeek(dateKeys, week, false)}
            </div>
            {swipe?.direction && previewWeek && (
              <div
                data-week-slide="preview"
                className="pointer-events-none col-start-1 row-start-1 min-w-0"
                data-settling={swipe.phase === 'settling'}
                aria-hidden="true"
                inert
                style={slideStyle(true)}
              >
                {renderWeek(previewDateKeys, previewWeek, true)}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedProject && (
        <DailyProjectAssignmentsDialog
          key={`${selectedProject.id}:${selectedDateKey}`}
          project={selectedProject}
          dateLabel={formatLongDay(selectedDateKey, true)}
          members={members}
          crews={crews}
          assignments={currentAssignments}
          hasOverride={Boolean(activeOverride)}
          saving={savingKey === `${selectedDateKey}:${selectedProject.id}`}
          onClose={() => setEditingProjectId('')}
          onSave={(assignments) =>
            runSave(() => onSave(selectedProject.id, selectedDateKey, assignments))
          }
          onReset={() => runSave(() => onReset(selectedProject.id, selectedDateKey))}
        />
      )}
    </section>
  );
}

import { AlertTriangle, CirclePlus } from 'lucide-react';
import type { TeamJob } from '@/entities/workforce';
import { cn, type DateKey } from '@/shared/lib';
import { Alert } from '@/shared/ui';
import {
  dayConflicts,
  formatLongDay,
  formatShortWeekday,
  formatDayLabel,
  type DayScheduleRow,
} from '../model/schedule';
import { ProjectDayCard, TeamJobDayCard } from './DayCards';

interface DayScheduleProps {
  dateKey: DateKey;
  rows: DayScheduleRow[];
  jobs: TeamJob[];
  /** Phone/tablet layout: a single day with a heading instead of a column. */
  compact: boolean;
  /** Incoming week rendered during a swipe: no ids, roles or actions. */
  preview: boolean;
  selected: boolean;
  isToday: boolean;
  filtered: boolean;
  onSelect: () => void;
  onNewJob: () => void;
  onEditProject: (projectId: string) => void;
}

const newJobButtonClass =
  'focus-ring inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-primary';

export function DaySchedule({
  dateKey,
  rows,
  jobs,
  compact,
  preview,
  selected,
  isToday,
  filtered,
  onSelect,
  onNewJob,
  onEditProject,
}: DayScheduleProps) {
  const conflicts = selected ? dayConflicts(rows, jobs) : [];
  const longLabel = formatLongDay(dateKey);
  const newJobButton = (
    <button
      type="button"
      className={cn(newJobButtonClass, compact ? 'hover:bg-tint' : 'mb-2 hover:bg-surface')}
      aria-label="Nuevo trabajo"
      title={`Nuevo trabajo · ${longLabel}`}
      data-week-swipe-ignore
      onClick={onNewJob}
    >
      <CirclePlus size={15} aria-hidden="true" />
      Nuevo trabajo
    </button>
  );

  return (
    <section
      data-week-day={compact || preview ? undefined : dateKey}
      className={cn('min-w-0 rounded-2xl', !compact && 'border border-line bg-surface-muted p-2')}
      aria-label={longLabel}
    >
      {compact ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="text-lg font-semibold text-ink">{longLabel}</h3>
            {isToday && <span className="text-xs font-semibold text-brand-500">Hoy</span>}
          </div>
          {!preview && newJobButton}
        </div>
      ) : (
        <>
          <button
            type="button"
            className={cn(
              'focus-ring mb-2 w-full rounded-xl px-2 py-2 text-center',
              selected ? 'bg-tint-strong' : 'hover:bg-surface',
            )}
            aria-pressed={!preview && selected}
            onClick={preview ? undefined : onSelect}
          >
            <span className="block text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {formatShortWeekday(dateKey)}
            </span>
            <span className="mt-0.5 block text-lg font-semibold text-ink">
              {formatDayLabel(dateKey, { day: 'numeric' })}
            </span>
          </button>
          {!preview && newJobButton}
        </>
      )}
      {conflicts.length > 0 && (
        <Alert
          tone="warning"
          plain
          role={preview ? 'none' : 'alert'}
          className="mb-2 rounded-lg px-2 py-2 text-xs leading-4"
        >
          {conflicts.map((conflict) => (
            <p key={conflict.memberId}>
              <AlertTriangle className="mr-1 inline-block" size={13} aria-hidden="true" />
              <strong>Conflicto:</strong> {conflict.memberName} figura en{' '}
              {conflict.items.map((item) => item.title).join(' y ')}.
            </p>
          ))}
        </Alert>
      )}
      {rows.length === 0 && jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong bg-surface p-4 text-center text-xs leading-5 text-ink-subtle">
          {filtered
            ? 'No hay asignaciones de este equipo para este día.'
            : 'No hay proyectos ni trabajos puntuales para este día.'}
        </p>
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
                if (!preview) onEditProject(project.id);
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
}

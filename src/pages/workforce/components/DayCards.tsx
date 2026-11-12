import { ArrowRight, UsersRound } from 'lucide-react';
import type { Project, ProjectAssignment } from '@/entities/project';
import type { TeamJob, TeamJobAssignment } from '@/entities/workforce';
import { cn } from '@/shared/lib';
import { PageLink } from '@/shared/ui';
import { colorFor } from '../model/crewColors';

const cardClass = 'rounded-xl border border-line bg-surface p-2.5 shadow-card';
/** 32 px circular action on a calendar card (docs/styles-and-responsive.md, BG-011). */
const cardActionClass =
  'focus-ring grid size-8 min-h-8 shrink-0 aspect-square place-items-center rounded-full border border-line bg-surface-muted p-0 text-primary hover:bg-tint disabled:cursor-not-allowed disabled:opacity-50';

function AssignmentChip({
  assignment,
  showCrewMembers = true,
  emphasize = false,
}: {
  assignment: ProjectAssignment | TeamJobAssignment;
  showCrewMembers?: boolean;
  emphasize?: boolean;
}) {
  if (assignment.resourceType === 'crew') {
    const crewColor = colorFor(assignment.color ?? 'blue');
    return (
      <li
        className="rounded-lg px-2 py-1.5 text-xs leading-4"
        style={{ backgroundColor: crewColor.fill, color: crewColor.ink }}
      >
        <p className="font-semibold">{assignment.label}</p>
        {showCrewMembers && assignment.members.length > 0 && (
          <p className="mt-0.5 break-words opacity-85">
            {assignment.members.map((member) => member.name).join(', ')}
          </p>
        )}
      </li>
    );
  }
  return (
    <li
      className={cn(
        'rounded-lg bg-tint px-2 py-1.5 text-xs leading-4 text-ink-soft',
        emphasize ? 'font-semibold' : 'font-medium',
      )}
    >
      {assignment.label}
    </li>
  );
}

export function ProjectDayCard({
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
    <article data-testid={preview ? undefined : `day-project-${project.id}`} className={cardClass}>
      <div className="mb-2">
        <div className="min-w-0">
          <h4
            className="line-clamp-2 text-xs font-semibold leading-4 text-ink"
            title={project.title}
          >
            {project.title}
          </h4>
          {!project.estimatedEndDate && (
            <span className="text-xs font-medium text-warning-ink">Sin fecha estimada</span>
          )}
          {hasOverride && <span className="text-xs font-medium text-ink-subtle">Plan editado</span>}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1">
          <button
            type="button"
            className={cardActionClass}
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
            className={cardActionClass}
            aria-label={`Ir al proyecto ${project.title}`}
            title={`Ir al proyecto ${project.title}`}
            data-week-swipe-ignore
          >
            <ArrowRight size={16} aria-hidden="true" />
          </PageLink>
        </div>
      </div>

      {assignments.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-2 py-2 text-xs leading-4 text-ink-subtle">
          Sin equipo asignado
        </p>
      ) : (
        <ul className="space-y-1.5">
          {assignments.map((assignment) => (
            <AssignmentChip key={assignment.id} assignment={assignment} />
          ))}
        </ul>
      )}
    </article>
  );
}

export function TeamJobDayCard({ job, preview = false }: { job: TeamJob; preview?: boolean }) {
  return (
    <article data-testid={preview ? undefined : `day-job-${job.id}`} className={cardClass}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-xs font-semibold leading-4 text-ink">{job.title}</h4>
          {job.projectTitle && (
            <p className="mt-0.5 text-xs font-medium text-ink-subtle">{job.projectTitle}</p>
          )}
        </div>
        {job.projectId && (
          <PageLink
            to={`/projects/${job.projectId}`}
            className={cardActionClass}
            aria-label={`Ir al proyecto ${job.projectTitle ?? job.title}`}
            title={`Ir al proyecto ${job.projectTitle ?? job.title}`}
            data-week-swipe-ignore
          >
            <ArrowRight size={16} aria-hidden="true" />
          </PageLink>
        )}
      </div>
      {job.description && (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-4 text-ink-muted">
          {job.description}
        </p>
      )}
      <ul className="mt-2 space-y-1.5">
        {job.assignments.map((assignment) => (
          <AssignmentChip key={assignment.id} assignment={assignment} emphasize />
        ))}
      </ul>
    </article>
  );
}

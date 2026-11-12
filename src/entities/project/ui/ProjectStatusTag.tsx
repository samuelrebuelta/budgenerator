import { CheckCircle2, CircleDashed, Wrench } from 'lucide-react';
import type { ProjectStatus } from '../model/types';

const statusContent: Record<
  ProjectStatus,
  { label: string; icon: typeof CircleDashed; className: string }
> = {
  pending: {
    label: 'Pendiente',
    icon: CircleDashed,
    className: 'border-line-strong bg-canvas text-ink-muted',
  },
  in_progress: {
    label: 'En curso',
    icon: Wrench,
    className: 'border-accent-line bg-accent-surface text-accent-strong',
  },
  completed: {
    label: 'Completado',
    icon: CheckCircle2,
    className: 'border-success-line bg-success-surface text-success-ink',
  },
};

export function ProjectStatusTag({ status }: { status: ProjectStatus }) {
  const content = statusContent[status];
  const Icon = content.icon;

  return (
    <span
      role="status"
      aria-label={`Estado: ${content.label}`}
      data-project-status={status}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${content.className}`}
    >
      <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
      {content.label}
    </span>
  );
}

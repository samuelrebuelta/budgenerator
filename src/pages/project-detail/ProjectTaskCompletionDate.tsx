import { CalendarDays } from 'lucide-react';
import { getProjectLocalDateKey } from '@/entities/project/model/history';
import { LoadingSpinner } from '@/shared/ui';

interface ProjectTaskCompletionDateProps {
  subject: string;
  completedAt: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (date: string) => void;
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function compactDateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

export function ProjectTaskCompletionDate({
  subject,
  completedAt,
  disabled = false,
  loading = false,
  onChange,
}: ProjectTaskCompletionDateProps) {
  const date = getProjectLocalDateKey(completedAt);
  const today = getProjectLocalDateKey(new Date().toISOString());

  return (
    <span
      className="relative inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#b8c9be] bg-white px-2.5 text-xs font-medium text-[#315c4c] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#b7694d]"
      aria-busy={loading || undefined}
    >
      {loading ? <LoadingSpinner size={14} /> : <CalendarDays size={14} aria-hidden="true" />}
      <span>{compactDateLabel(date)}</span>
      <span className="sr-only">Fecha registrada: {subject}.</span>
      <input
        type="date"
        aria-label={`Cambiar fecha de finalización: ${subject}`}
        title={`Cambiar fecha de finalización · ${subject}. Fecha actual: ${dateLabel(date)}.`}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        value={date}
        max={today}
        disabled={disabled || loading}
        onChange={(event) => {
          if (event.currentTarget.value) onChange(event.currentTarget.value);
        }}
      />
    </span>
  );
}

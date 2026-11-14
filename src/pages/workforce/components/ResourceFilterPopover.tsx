import { useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ListFilter } from 'lucide-react';
import type { DailyAssignmentResourceFilter } from '@/entities/project';
import type { WorkCrew, WorkforceMember } from '@/entities/workforce';
import { cn } from '@/shared/lib';
import { isResourceSelected, toggleResource } from '../model/schedule';

interface ResourceFilterPopoverProps {
  members: WorkforceMember[];
  crews: WorkCrew[];
  selected: DailyAssignmentResourceFilter[];
  onChange: (selected: DailyAssignmentResourceFilter[]) => void;
}

const optionClass =
  'flex min-h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm text-ink-soft hover:bg-surface-muted';
const legendClass = 'mb-0.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle';

/**
 * Floating member/crew filter over the calendar. A `<details>` keeps it next to the calendar;
 * it closes on a pointer outside its surface (docs/styles-and-responsive.md).
 */
export function ResourceFilterPopover({
  members,
  crews,
  selected,
  onChange,
}: ResourceFilterPopoverProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const memberOptions = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [members],
  );
  const crewOptions = useMemo(
    () => [...crews].sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [crews],
  );

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const filter = ref.current;
      if (filter?.open && !filter.contains(event.target as Node)) filter.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  const toggle = (resource: DailyAssignmentResourceFilter) =>
    onChange(toggleResource(selected, resource));

  return (
    <details
      ref={ref}
      className="relative z-(--z-dropdown) w-full sm:w-auto"
      data-testid="weekly-resource-filter"
    >
      <summary className="focus-ring ml-auto flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink-soft shadow-card hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <ListFilter size={16} aria-hidden="true" />
        <span>Filtrar equipo</span>
        <span className="rounded-full bg-tint px-2 py-0.5 text-xs text-ink-muted">
          {selected.length === 0 ? 'Todos' : selected.length}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] max-h-[min(28rem,55dvh)] w-[min(20rem,calc(100vw_-_2.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-3 shadow-popover">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs leading-4 text-ink-subtle">
            Coincide con cualquiera de los recursos.
          </p>
          {selected.length > 0 && (
            <button
              type="button"
              aria-label="Limpiar filtros"
              className="focus-ring min-h-8 shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-primary hover:text-ink-strong"
              onClick={() => onChange([])}
            >
              Limpiar
            </button>
          )}
        </div>
        {memberOptions.length > 0 && (
          <fieldset className="space-y-0.5">
            <legend className={legendClass}>Miembros</legend>
            {memberOptions.map((member) => {
              const resource = { type: 'member' as const, id: member.id };
              return (
                <label key={member.id} className={optionClass}>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={`Mostrar asignaciones de ${member.name}`}
                    checked={isResourceSelected(selected, resource)}
                    onChange={() => toggle(resource)}
                  />
                  <span className="min-w-0 flex-1 truncate">{member.name}</span>
                  {member.status === 'inactive' && (
                    <span className="text-xs text-ink-subtle">Inactivo</span>
                  )}
                </label>
              );
            })}
          </fieldset>
        )}
        {crewOptions.length > 0 && (
          <fieldset
            className={cn(
              'space-y-0.5',
              memberOptions.length > 0 && 'mt-2 border-t border-line pt-2',
            )}
          >
            <legend className={legendClass}>Cuadrillas</legend>
            {crewOptions.map((crew) => {
              const resource = { type: 'crew' as const, id: crew.id };
              return (
                <label key={crew.id} className={optionClass}>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={`Mostrar asignaciones de cuadrilla ${crew.label}`}
                    checked={isResourceSelected(selected, resource)}
                    onChange={() => toggle(resource)}
                  />
                  <span className="min-w-0 flex-1 truncate">{crew.label}</span>
                  {crew.status === 'inactive' && (
                    <span className="text-xs text-ink-subtle">Inactiva</span>
                  )}
                </label>
              );
            })}
          </fieldset>
        )}
      </div>
    </details>
  );
}

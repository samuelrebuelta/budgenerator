import { useEffect, useRef, type ChangeEvent } from 'react';
import { CalendarDays } from 'lucide-react';

interface ProjectEstimatedEndDateProps {
  estimatedEndDate?: string;
  disabled?: boolean;
  loading?: boolean;
  onSave: (date: string) => Promise<boolean>;
}

export function ProjectEstimatedEndDate({
  estimatedEndDate,
  disabled = false,
  loading = false,
  onSave,
}: ProjectEstimatedEndDateProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingDateRef = useRef<string | null>(null);
  const pointerSelectionRef = useRef(false);
  const currentDateRef = useRef(estimatedEndDate);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    currentDateRef.current = estimatedEndDate;
    onSaveRef.current = onSave;
    if (!pendingDateRef.current && inputRef.current)
      inputRef.current.value = estimatedEndDate ?? '';
  }, [estimatedEndDate, onSave]);

  const persistDate = async (date: string) => {
    if (date === currentDateRef.current) return;
    const saved = await onSaveRef.current(date).catch(() => false);
    if (!saved && inputRef.current) inputRef.current.value = currentDateRef.current ?? '';
  };

  const commitPendingDate = () => {
    const date = pendingDateRef.current;
    pendingDateRef.current = null;
    if (date && date !== currentDateRef.current) void persistDate(date);
  };

  useEffect(
    () => () => {
      const date = pendingDateRef.current;
      pendingDateRef.current = null;
      if (date && date !== currentDateRef.current) void persistDate(date);
    },
    [],
  );

  const updateDate = (event: ChangeEvent<HTMLInputElement>) => {
    const date = event.currentTarget.value;
    if (!date) {
      pendingDateRef.current = null;
      if (inputRef.current) inputRef.current.value = currentDateRef.current ?? '';
      return;
    }
    if (date === currentDateRef.current) {
      pendingDateRef.current = null;
      return;
    }
    pendingDateRef.current = date;
    if (pointerSelectionRef.current) {
      pointerSelectionRef.current = false;
      commitPendingDate();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#354b42]">
        <span>Fecha estimada de fin del proyecto</span>
        <span
          className="relative inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#b8c9be] bg-white px-3 text-sm font-medium text-[#315c4c] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#b7694d]"
          aria-busy={loading || undefined}
        >
          <CalendarDays size={15} aria-hidden="true" />
          <input
            ref={inputRef}
            type="date"
            defaultValue={estimatedEndDate ?? ''}
            aria-label="Fecha estimada de fin del proyecto"
            className="min-w-0 bg-transparent text-sm text-[#263a32] outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || loading}
            onPointerDown={() => {
              pointerSelectionRef.current = true;
            }}
            onKeyDown={() => {
              pointerSelectionRef.current = false;
            }}
            onChange={updateDate}
            onBlur={() => {
              pointerSelectionRef.current = false;
              commitPendingDate();
            }}
          />
        </span>
      </label>
      <p className="text-xs text-[#637166]" aria-live="polite">
        {loading
          ? 'Guardando fecha…'
          : 'Se guarda al cambiarla. En Equipo se mostrará el proyecto hasta esa fecha.'}
      </p>
    </div>
  );
}

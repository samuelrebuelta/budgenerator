import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/lib';
import { LoadingSpinner } from './LoadingSpinner';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  id?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  leading,
  disabled = false,
  loading = false,
  className,
  id,
}: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? `switch-${generatedId}`;
  const labelId = `${controlId}-label`;
  const descriptionId = `${controlId}-description`;

  return (
    <label
      htmlFor={controlId}
      aria-busy={loading || undefined}
      className={cn(
        'group flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 text-left',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {leading && <span className="shrink-0 self-start pt-0.5">{leading}</span>}
        <span className="min-w-0">
          <span id={labelId} className="block font-medium leading-5 text-gray-900">
            {label}
          </span>
          {description && (
            <span id={descriptionId} className="mt-1 block text-sm leading-5 text-gray-600">
              {description}
            </span>
          )}
        </span>
      </span>

      <span className="inline-flex shrink-0 items-center gap-2">
        {loading && <LoadingSpinner size={15} />}
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
          <input
            id={controlId}
            type="checkbox"
            role="switch"
            checked={checked}
            disabled={disabled}
            aria-checked={checked}
            aria-labelledby={labelId}
            aria-describedby={description ? descriptionId : undefined}
            onChange={(event) => onCheckedChange(event.currentTarget.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-gray-300 transition-colors duration-150 peer-checked:bg-[#426457] peer-focus-visible:ring-2 peer-focus-visible:ring-[#234c40] peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed motion-reduce:transition-none after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:content-[''] after:transition-transform after:duration-150 peer-checked:after:translate-x-5 motion-reduce:after:transition-none"
          />
        </span>
      </span>
    </label>
  );
}

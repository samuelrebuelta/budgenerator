import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

/** Props a `Field` hands to its control so label, help and error stay connected. */
export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

export interface FieldProps {
  label: ReactNode;
  /** Short help shown below the control. */
  hint?: ReactNode;
  /** Validation message; marks the control as invalid. */
  error?: ReactNode;
  /** Marks the control as required for assistive technology (the label is not changed). */
  required?: boolean;
  /** Use an existing id instead of a generated one. */
  id?: string;
  /** Visually hide the label (it is still announced). */
  hideLabel?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm text-danger-ink" role="alert">
      {children}
    </p>
  );
}

/** Label + control + help + error with `aria-describedby` and `aria-invalid` wired. */
export function Field({
  label,
  hint,
  error,
  required,
  id,
  hideLabel,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={controlId}
        className={cn('text-sm font-medium text-ink-soft', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      {children({
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-ink-subtle">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

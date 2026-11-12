import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/shared/lib/utils';
import { Field } from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Text input. With `label` it renders a `Field` (generated id, help and error wiring). */
export function Input({ label, hint, error, className, id, required, ...props }: InputProps) {
  if (!label)
    // The wrapper is kept for layout compatibility with existing callers.
    return (
      <div className="flex flex-col gap-1">
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn('ui-control', className)}
          {...props}
        />
      </div>
    );
  return (
    <Field label={label} hint={hint} error={error} id={id} required={required}>
      {(control) => (
        <input
          {...control}
          required={required}
          className={cn('ui-control', className)}
          {...props}
        />
      )}
    </Field>
  );
}

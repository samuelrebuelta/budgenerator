import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';
import { Field } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ label, hint, error, className, id, required, ...props }: TextareaProps) {
  if (!label)
    return (
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn('ui-control', className)}
        {...props}
      />
    );
  return (
    <Field label={label} hint={hint} error={error} id={id} required={required}>
      {(control) => (
        <textarea
          {...control}
          required={required}
          className={cn('ui-control', className)}
          {...props}
        />
      )}
    </Field>
  );
}

import type { Ref, SelectHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';
import { Field } from './Field';

interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  id,
  required,
  ...props
}: SelectProps) {
  const control = (fieldProps: object) => (
    <select
      id={id}
      required={required}
      aria-invalid={error ? true : undefined}
      {...fieldProps}
      className={cn('ui-control ui-select', className)}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
  if (!label) return <div className="flex flex-col gap-1">{control({})}</div>;
  return (
    <Field label={label} hint={hint} error={error} id={id} required={required}>
      {(fieldProps) => control(fieldProps)}
    </Field>
  );
}

import type { ButtonHTMLAttributes, Ref } from 'react';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { LoadingSpinner } from './LoadingSpinner';

export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** `sm` 36 px, `md` 44 px (default, touch size), `lg` 48 px. */
  size?: ButtonSize;
  /** Square button for a single icon; prefer `IconButton`, which requires a label. */
  icon?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon = false,
  fullWidth = false,
  className,
  ref,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, icon, fullWidth, className })}
      {...props}
    >
      {loading && <LoadingSpinner />}
      {children}
    </button>
  );
}

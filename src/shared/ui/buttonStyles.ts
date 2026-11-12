import { cn } from '@/shared/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  fullWidth?: boolean;
  className?: string;
}

/** Class list of a Button, for links or other elements that must look like one. */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  icon = false,
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    'ui-button',
    `ui-button--${variant}`,
    size !== 'md' && `ui-button--${size}`,
    icon && 'ui-button--icon',
    fullWidth && 'ui-button--full',
    className,
  );
}

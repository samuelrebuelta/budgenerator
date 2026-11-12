import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'children' | 'aria-label'> {
  /** Accessible name; also shown as the native tooltip. */
  label: string;
  icon: ReactNode;
}

/** Circular button with a single icon and a mandatory accessible name. */
export function IconButton({ label, icon, variant = 'ghost', title, ...props }: IconButtonProps) {
  return (
    <Button {...props} variant={variant} icon aria-label={label} title={title ?? label}>
      {props.loading ? null : icon}
    </Button>
  );
}

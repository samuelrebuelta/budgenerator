import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import type { Tone } from './Alert';

export type BadgeTone = Tone | 'brand';

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-line text-ink-soft',
  brand: 'bg-tint text-primary',
  info: 'bg-info-surface text-info-ink',
  success: 'bg-success-surface text-success-ink',
  warning: 'bg-warning-surface text-warning-ink',
  danger: 'bg-danger-surface text-danger-ink',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Short status label. Entities map their states to a tone and text. */
export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        toneStyles[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

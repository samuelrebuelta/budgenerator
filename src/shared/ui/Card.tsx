import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

const variants = {
  /** Default card (raised, kept for existing screens). */
  raised: 'bg-white rounded-xl shadow-sm border border-gray-200',
  plain: 'bg-surface rounded-card border border-line',
  muted: 'bg-surface-muted rounded-card border border-line',
  interactive:
    'bg-surface rounded-card border border-line transition-colors hover:bg-tint focus-within:border-line-strong',
};

const paddings = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' };

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: keyof typeof variants;
  padding?: keyof typeof paddings;
}

export function Card({ children, className, variant = 'raised', padding = 'none' }: CardProps) {
  return <div className={cn(variants[variant], paddings[padding], className)}>{children}</div>;
}

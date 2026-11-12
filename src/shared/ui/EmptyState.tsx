import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export interface EmptyStateProps {
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>;
  title: ReactNode;
  description?: ReactNode;
  /** Main action (Button, PageLink…). */
  action?: ReactNode;
  /** `card` draws a dashed surface; `plain` only centres the content. */
  variant?: 'card' | 'plain';
  /** Heading level of the title. */
  headingLevel?: 2 | 3;
  role?: 'status';
  className?: string;
}

/** Empty, filtered-out or unavailable content with an optional next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'card',
  headingLevel = 2,
  role,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      role={role}
      aria-live={role ? 'polite' : undefined}
      className={cn(
        'px-6 py-10 text-center sm:px-10',
        variant === 'card' && 'rounded-2xl border border-dashed border-line-strong bg-surface',
        className,
      )}
    >
      {Icon && (
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-tint text-primary">
          <Icon size={21} aria-hidden="true" />
        </div>
      )}
      <Heading className={cn('text-lg font-semibold text-ink', Icon && 'mt-4')}>{title}</Heading>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  );
}

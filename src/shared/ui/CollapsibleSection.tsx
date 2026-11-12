import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface CollapsibleSectionProps {
  title: ReactNode;
  /** Extra content on the header row (totals, badges), outside the toggle button. */
  aside?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controlled state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Heading that wraps the toggle button. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

/** Disclosure with a real `<button aria-expanded aria-controls>` and animated content. */
export function CollapsibleSection({
  title,
  aside,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  headingLevel = 2,
  className,
  headerClassName,
  contentClassName,
}: CollapsibleSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const contentId = `collapsible-${useId()}`;
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const toggle = () => {
    const next = !open;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  return (
    <section className={className}>
      <div className={cn('flex items-center justify-between gap-3', headerClassName)}>
        <Heading className="min-w-0 flex-1 text-base font-semibold text-ink">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={toggle}
            className="focus-ring flex w-full min-w-0 items-center gap-2 rounded-lg py-2 text-left"
          >
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={cn(
                'shrink-0 text-ink-muted transition-transform motion-reduce:transition-none',
                !open && '-rotate-90',
              )}
            />
            <span className="min-w-0">{title}</span>
          </button>
        </Heading>
        {aside}
      </div>
      <div id={contentId} className={cn('collapsible', open && 'open')} inert={!open}>
        <div className={contentClassName}>{children}</div>
      </div>
    </section>
  );
}

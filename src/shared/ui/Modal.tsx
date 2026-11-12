import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { IconButton } from './IconButton';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'sheet';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  /**
   * Accessible name of the dialog. Pass the same text as the visible heading, or omit it and
   * render a `ModalHeader`, which labels the dialog through `aria-labelledby`.
   */
  title?: string;
  /** Panel width: sm 384 px (default), md 512, lg 672, xl 896; `sheet` docks to the bottom on phones. */
  size?: ModalSize;
}

const ModalTitleContext = createContext<string | undefined>(undefined);
const FALLBACK_LABEL = 'Ventana de diálogo';

export function Modal({
  open,
  onClose,
  children,
  overlayClassName,
  panelClassName,
  title,
  size = 'sm',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `dialog-title-${useId()}`;
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scroll = document.body.style.overflow;
    dialog.dataset.keyboardNavigation = String(previous?.matches(':focus-visible') ?? false);
    const markKeyboardNavigation = (event: KeyboardEvent) => {
      if (event.key === 'Tab') dialog.dataset.keyboardNavigation = 'true';
    };
    const markPointerNavigation = () => {
      dialog.dataset.keyboardNavigation = 'false';
    };
    dialog.addEventListener('keydown', markKeyboardNavigation);
    dialog.addEventListener('pointerdown', markPointerNavigation);
    // Without `title` the dialog is named by its ModalHeader; keep a generic name otherwise.
    if (!title && !dialog.querySelector(`[id="${titleId}"]`))
      dialog.setAttribute('aria-label', FALLBACK_LABEL);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.removeEventListener('keydown', markKeyboardNavigation);
      dialog.removeEventListener('pointerdown', markPointerNavigation);
      dialog.close();
      document.body.style.overflow = scroll;
      previous?.focus();
    };
  }, [open, title, titleId]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      aria-label={title}
      aria-labelledby={title ? undefined : titleId}
      className={cn(
        'modal-overlay no-print',
        size === 'sheet' && 'ui-modal-overlay--sheet',
        overlayClassName,
      )}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const elements = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = elements[0];
        const last = elements.at(-1);
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === event.currentTarget)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ModalTitleContext.Provider value={titleId}>
        <div
          className={cn(
            'modal-panel ui-modal-panel',
            size !== 'sm' && `ui-modal-panel--${size}`,
            panelClassName,
          )}
        >
          {children}
        </div>
      </ModalTitleContext.Provider>
    </dialog>
  );
}

interface ModalHeaderProps {
  /** Visible heading; it also names the dialog when `Modal` has no `title`. */
  title: ReactNode;
  description?: ReactNode;
  /** Shows a close button. */
  onClose?: () => void;
  closeLabel?: string;
}

/** Heading row for a dialog. Must be rendered inside `Modal`. */
export function ModalHeader({
  title,
  description,
  onClose,
  closeLabel = 'Cerrar',
}: ModalHeaderProps) {
  const titleId = useContext(ModalTitleContext);
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {onClose && (
        <IconButton
          label={closeLabel}
          icon={<X size={18} aria-hidden="true" />}
          size="sm"
          className="-mr-2 -mt-1"
          onClick={onClose}
        />
      )}
    </div>
  );
}

export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-w-0', className)}>{children}</div>;
}

export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-6 flex flex-wrap items-center justify-end gap-3', className)}>
      {children}
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/shared/lib';
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  title?: string;
}
export function Modal({
  open,
  onClose,
  children,
  overlayClassName,
  panelClassName,
  title = 'Ventana de diálogo',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scroll = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = scroll;
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={cn('modal-overlay no-print', overlayClassName)}
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
      <div
        className={cn(
          'modal-panel bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-sm',
          panelClassName,
        )}
      >
        {children}
      </div>
    </dialog>
  );
}

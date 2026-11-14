import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, WifiOff, X } from 'lucide-react';
import { dismissToast, useToastStore, type ToastTone } from '@/shared/model/toast';
import { cn } from '@/shared/lib/utils';

const toneStyles: Record<ToastTone, string> = {
  info: 'border-info-line text-info-ink',
  success: 'border-success-line text-success-ink',
  warning: 'border-warning-line text-warning-ink',
  error: 'border-danger-line text-danger-ink',
};

const toneIcons: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: WifiOff,
};

/** Renders the app-wide toast from `showToast()` (shared/model/toast). */
export function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (toast && dialog && !dialog.open) dialog.show();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [toast]);

  if (!toast) return null;
  const Icon = toast.id.startsWith('offline-') ? WifiOff : toneIcons[toast.tone];
  const urgent = toast.tone === 'error' || toast.tone === 'warning';
  return (
    <dialog
      ref={dialogRef}
      aria-label={toast.title ?? (urgent ? 'Aviso' : 'Notificación')}
      className="fixed inset-x-4 bottom-6 z-(--z-toast) m-0 mx-auto w-[calc(100%-2rem)] max-w-sm overflow-visible border-0 bg-transparent p-0 text-left backdrop:bg-transparent sm:left-auto sm:right-6"
      onCancel={(event) => event.preventDefault()}
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-toast',
          toneStyles[toast.tone],
        )}
        data-testid={toast.id.startsWith('offline-') ? 'offline-mutation-toast' : 'app-toast'}
        role={urgent ? 'alert' : 'status'}
        aria-live={urgent ? 'assertive' : 'polite'}
      >
        <Icon size={18} aria-hidden="true" className="shrink-0" />
        <div className="min-w-0 flex-1">
          {toast.title && <p className="font-semibold">{toast.title}</p>}
          <p>{toast.message}</p>
        </div>
        <button
          type="button"
          className="grid size-9 min-h-9 shrink-0 place-items-center rounded-full hover:bg-black/5"
          aria-label="Cerrar aviso"
          onClick={() => dismissToast(toast.id)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  );
}

import { useEffect, useRef } from 'react';
import { WifiOff, X } from 'lucide-react';
import { dismissToast, useToastStore } from '@/shared/model/toast';

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
  return (
    <dialog
      ref={dialogRef}
      aria-label="Aviso de conexión"
      className="fixed inset-x-4 bottom-6 m-0 mx-auto w-[calc(100%-2rem)] max-w-sm overflow-visible border-0 bg-transparent p-0 text-left backdrop:bg-transparent sm:left-auto sm:right-6"
      onCancel={(event) => event.preventDefault()}
    >
      <div
        className="flex items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-900 shadow-xl"
        data-testid="offline-mutation-toast"
        role="alert"
        aria-live="assertive"
      >
        <WifiOff size={18} aria-hidden="true" className="shrink-0" />
        <span className="flex-1">{toast.message}</span>
        <button
          type="button"
          className="rounded-md p-1 text-red-800 hover:bg-red-50"
          aria-label="Cerrar aviso"
          onClick={() => dismissToast(toast.id)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  );
}

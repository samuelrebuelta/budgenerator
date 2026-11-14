import { createStore } from 'zustand/vanilla';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface AppToast {
  id: string;
  message: string;
  tone: ToastTone;
  title?: string;
  /** Higher priority toasts replace lower ones; equal priority replaces the current one. */
  priority: number;
}

export interface ShowToastOptions {
  message: string;
  tone?: ToastTone;
  title?: string;
  /** Milliseconds before closing; `0` keeps it until dismissed. Defaults to 4500. */
  duration?: number;
  priority?: number;
  id?: string;
}

export interface ToastState {
  toast: AppToast | null;
  offlineNoticeShown: boolean;
}

/** The single app-wide toast; the web binds it as `useToastStore`. */
export const toastStore = createStore<ToastState>()(() => ({
  toast: null,
  offlineNoticeShown: false,
}));

let toastSequence = 0;

export function dismissToast(id?: string) {
  toastStore.setState((state) => (!id || state.toast?.id === id ? { toast: null } : state));
}

/** Shows the single app-wide toast. Returns its id, or null if a more important one is visible. */
export function showToast({
  message,
  tone = 'info',
  title,
  duration = 4500,
  priority = tone === 'error' ? 2 : 1,
  id,
}: ShowToastOptions): string | null {
  const current = toastStore.getState().toast;
  if (current && current.priority > priority) return null;
  const toast: AppToast = { id: id ?? `toast-${++toastSequence}`, message, tone, title, priority };
  toastStore.setState({ toast });
  if (duration > 0) setTimeout(() => dismissToast(toast.id), duration);
  return toast.id;
}

export function showOfflineMutationToast() {
  if (toastStore.getState().offlineNoticeShown) return;
  const id = showToast({
    id: `offline-${++toastSequence}`,
    message: 'Sin conexión. No se ha podido guardar el cambio.',
    tone: 'error',
  });
  if (id) toastStore.setState({ offlineNoticeShown: true });
}

export function resetOfflineMutationToast() {
  toastStore.setState({ offlineNoticeShown: false });
}

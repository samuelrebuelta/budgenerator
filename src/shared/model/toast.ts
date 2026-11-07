import { create } from 'zustand';

export interface AppToast {
  id: string;
  message: string;
  tone: 'error';
}

interface ToastState {
  toast: AppToast | null;
  offlineNoticeShown: boolean;
}

export const useToastStore = create<ToastState>(() => ({
  toast: null,
  offlineNoticeShown: false,
}));

let toastSequence = 0;

export function dismissToast(id?: string) {
  useToastStore.setState((state) => (!id || state.toast?.id === id ? { toast: null } : state));
}

export function showOfflineMutationToast() {
  const state = useToastStore.getState();
  if (state.offlineNoticeShown) return;
  const toast: AppToast = {
    id: `offline-${++toastSequence}`,
    message: 'Sin conexión. No se ha podido guardar el cambio.',
    tone: 'error',
  };
  useToastStore.setState({ toast, offlineNoticeShown: true });
  setTimeout(() => dismissToast(toast.id), 4500);
}

export function resetOfflineMutationToast() {
  useToastStore.setState({ offlineNoticeShown: false });
}

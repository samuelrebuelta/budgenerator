import { toastStore } from '@bg/app-core/toast';
import { bindStore } from '@/shared/lib/bindStore';

export {
  dismissToast,
  showToast,
  showOfflineMutationToast,
  resetOfflineMutationToast,
  type AppToast,
  type ShowToastOptions,
  type ToastState,
  type ToastTone,
} from '@bg/app-core/toast';

export const useToastStore = bindStore(toastStore);

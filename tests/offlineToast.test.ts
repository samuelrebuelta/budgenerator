import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetOfflineMutationToast,
  showOfflineMutationToast,
  useToastStore,
} from '../src/shared/model/toast';

describe('offline mutation toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toast: null, offlineNoticeShown: false });
  });

  it('shows one Spanish alert and coalesces repeated notices', () => {
    showOfflineMutationToast();
    const first = useToastStore.getState().toast;
    showOfflineMutationToast();

    expect(first?.message).toBe('Sin conexión. No se ha podido guardar el cambio.');
    expect(first?.tone).toBe('error');
    expect(useToastStore.getState().toast?.id).toBe(first?.id);
  });

  it('allows a new notice after the network recovers', () => {
    showOfflineMutationToast();
    const first = useToastStore.getState().toast;

    vi.advanceTimersByTime(5000);
    resetOfflineMutationToast();
    showOfflineMutationToast();

    expect(useToastStore.getState().toast?.id).not.toBe(first?.id);
  });
});

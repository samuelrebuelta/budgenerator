import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { toUserMessage } from '@bg/domain/lib/errors';
import { allowSavedMutation } from '../budgets/offline';

export type Feedback = 'selection' | 'success' | 'none';

/** Haptic feedback; the simulator and devices without a Taptic Engine just ignore it. */
export function haptic(kind: Feedback | 'warning') {
  const run =
    kind === 'selection'
      ? Haptics.selectionAsync()
      : kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : kind === 'warning'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : null;
  void run?.catch(() => undefined);
}

const isOffline = (error: unknown) =>
  (error as { code?: string } | null)?.code === 'offline/no-connection';

/** Messages of the web's project detail (`userFacingError`), without raw library text. */
export function projectErrorMessage(error: unknown, fallback: string) {
  return toUserMessage(error, {
    fallback,
    offline: 'No hay conexión con el servicio.',
    permissionDenied: 'No tienes acceso a este proyecto.',
  });
}

/**
 * Project mutations (all Firestore transactions). D4: offline they are blocked before anything
 * happens, with the BG-012 toast (marking items without network is phase 3). The repository guard
 * blocks them as well; checking here first keeps the haptic and the busy state out of it.
 */
export function useProjectMutation() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    { feedback = 'none', fallback = 'No se ha podido actualizar el avance.' } = {} as {
      feedback?: Feedback;
      fallback?: string;
    },
  ) => {
    if (busy) return false;
    if (!allowSavedMutation()) {
      haptic('warning');
      return false;
    }
    setBusy(key);
    setError('');
    try {
      await action();
      haptic(feedback);
      return true;
    } catch (reason) {
      if (!isOffline(reason)) setError(projectErrorMessage(reason, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { busy, error, setError, run };
}

import type { MutationGuard } from '@bg/firebase-api/firestorePort';
import {
  isBrowserDisconnected,
  markNetworkAvailable,
  reportNetworkUnavailable,
} from './network.js';
import { showOfflineMutationToast } from './toast.js';

export class OfflineMutationError extends Error {
  readonly code = 'offline/no-connection';

  constructor() {
    super('Sin conexión. No se ha podido guardar el cambio.');
    this.name = 'OfflineMutationError';
  }
}

export async function runNetworkMutation<T>(operation: () => Promise<T>): Promise<T> {
  if (isBrowserDisconnected()) {
    showOfflineMutationToast();
    throw new OfflineMutationError();
  }

  try {
    const result = await operation();
    markNetworkAvailable();
    return result;
  } catch (error) {
    if (reportNetworkUnavailable(error)) showOfflineMutationToast();
    throw error;
  }
}

/** `MutationGuard` of the shared repositories (`@bg/firebase-api`): blocks offline, reports errors. */
export const guardNetworkMutation: MutationGuard =
  (operation) =>
  (...args) =>
    runNetworkMutation(() => operation(...args));

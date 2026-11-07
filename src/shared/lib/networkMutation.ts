import {
  isBrowserDisconnected,
  markNetworkAvailable,
  reportNetworkUnavailable,
} from '@/shared/model/network';
import { showOfflineMutationToast } from '@/shared/model/toast';

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

export function guardNetworkMutation<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return (...args) => runNetworkMutation(() => operation(...args));
}

/**
 * Error messages for the UI. Never show `error.message` from libraries (Firebase, fetch…):
 * they are technical and usually in English.
 */

/** An error whose message is written for the user and can be shown as is. */
export class UserFacingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UserFacingError';
  }
}

export interface UserMessageContext {
  /** Shown when the error is unknown. */
  fallback?: string;
  /** Replaces the generic permission message (e.g. «No tienes acceso a este proyecto.»). */
  permissionDenied?: string;
  /** Replaces the generic connection message. */
  offline?: string;
}

const DEFAULT_FALLBACK = 'No se ha podido completar la acción. Vuelve a intentarlo.';
const DEFAULT_PERMISSION = 'No tienes permiso para realizar esta acción.';
const DEFAULT_OFFLINE = 'No hay conexión con el servicio. Comprueba la red y vuelve a intentarlo.';

const OFFLINE_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'auth/network-request-failed',
  'functions/unavailable',
  'functions/deadline-exceeded',
  'offline/read-unavailable',
]);
const PERMISSION_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'functions/permission-denied',
  'functions/unauthenticated',
]);

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** Classifies an error by its code (Firebase, network) and never returns a raw library message. */
export function toUserMessage(error: unknown, context: string | UserMessageContext = {}): string {
  const {
    fallback = DEFAULT_FALLBACK,
    permissionDenied,
    offline,
  } = typeof context === 'string' ? { fallback: context } : context;
  if (error instanceof UserFacingError) return error.message;
  const code = errorCode(error);
  if (code) {
    if (OFFLINE_CODES.has(code)) return offline ?? DEFAULT_OFFLINE;
    if (PERMISSION_CODES.has(code)) return permissionDenied ?? DEFAULT_PERMISSION;
    if (code === 'not-found') return 'El elemento ya no existe. Recarga la página.';
    if (code === 'resource-exhausted')
      return 'Se ha alcanzado un límite del servicio. Inténtalo más tarde.';
    return fallback;
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message))
    return offline ?? DEFAULT_OFFLINE;
  // Transitional: plain `Error`s thrown by app code carry Spanish copy. Library errors are
  // subclasses or carry a `code`, so they never reach this branch.
  if (error instanceof Error && error.constructor === Error && error.message) return error.message;
  return fallback;
}

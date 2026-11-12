import type { CallableRequest } from 'firebase-functions/v2/https';
import { httpsError } from './observability.js';

type AuthLike = Pick<CallableRequest, 'auth'>;

export function requireUid(request: AuthLike, message = 'Inicia sesión para continuar.') {
  const uid = request.auth?.uid;
  if (!uid) throw httpsError('unauthenticated', message, 'unauthenticated');
  return uid;
}

/** Public exposure (estimator links) requires a verified email address. */
export function requireVerifiedEmail(request: AuthLike) {
  const uid = requireUid(request);
  if (request.auth?.token.email_verified !== true)
    throw httpsError(
      'failed-precondition',
      'Verifica tu email antes de publicar. Revisa tu bandeja de entrada.',
      'email_not_verified',
    );
  return uid;
}

export const RECENT_LOGIN_MS = 5 * 60_000;

/** Destructive account operations require a sign-in in the last few minutes. */
export function requireRecentLogin(request: AuthLike, nowMs = Date.now()) {
  const uid = requireUid(request);
  const authTime = request.auth?.token.auth_time;
  if (typeof authTime !== 'number' || nowMs - authTime * 1000 > RECENT_LOGIN_MS)
    throw httpsError(
      'unauthenticated',
      'Por seguridad, vuelve a introducir tu contraseña.',
      'recent_login_required',
    );
  return uid;
}

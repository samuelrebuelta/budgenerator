import { createHash } from 'node:crypto';
import { logger } from 'firebase-functions/logger';
import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

/**
 * Stable machine-readable reasons sent to clients in `HttpsError.details.reason`.
 * The message stays human-readable Spanish; clients branch on `reason`.
 */
export type ErrorReason =
  | 'rate_limited'
  | 'app_check_required'
  | 'email_not_verified'
  | 'recent_login_required'
  | 'unauthenticated'
  | 'internal';

/**
 * Short, non-reversible pseudonym for identifiers (UID, token, IP) in logs.
 * Never log the raw value: UIDs, public tokens and IPs are personal data or secrets.
 */
export function pseudonym(value: string | undefined | null) {
  if (!value) return 'none';
  return createHash('sha256').update(`bg-log:${value}`).digest('hex').slice(0, 12);
}

type LogFields = Record<string, string | number | boolean | null | undefined>;

/** Structured log entry with a stable `event` name for log-based metrics. */
export function logEvent(
  severity: 'debug' | 'info' | 'warn' | 'error',
  event: string,
  fields: LogFields = {},
) {
  logger[severity](event, { event, ...fields });
}

export function httpsError(
  code: FunctionsErrorCode,
  message: string,
  reason: ErrorReason,
): HttpsError {
  return new HttpsError(code, message, { reason });
}

const expectedClientCodes = new Set<FunctionsErrorCode>([
  'invalid-argument',
  'not-found',
  'failed-precondition',
  'already-exists',
  'unauthenticated',
  'permission-denied',
  'aborted',
]);

/**
 * Wraps a handler so every invocation leaves one structured log line and
 * unexpected errors reach the client as a uniform `internal` error without
 * leaking stack traces or personal data.
 */
export async function observe<T>(fn: string, run: () => Promise<T> | T): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    logEvent('info', 'function_succeeded', { fn, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof HttpsError) {
      const reason =
        typeof (error.details as { reason?: unknown } | undefined)?.reason === 'string'
          ? (error.details as { reason: string }).reason
          : undefined;
      logEvent(
        error.code === 'resource-exhausted'
          ? 'warn'
          : expectedClientCodes.has(error.code)
            ? 'info'
            : 'error',
        error.code === 'resource-exhausted' ? 'rate_limited' : 'function_rejected',
        { fn, code: error.code, reason, durationMs },
      );
      throw error;
    }
    logEvent('error', 'function_failed', {
      fn,
      durationMs,
      errorName: error instanceof Error ? error.name : typeof error,
      // Firestore/Admin errors carry a numeric or string code, never user data.
      errorCode: String((error as { code?: unknown })?.code ?? 'unknown').slice(0, 60),
    });
    throw httpsError('internal', 'Se ha producido un error. Inténtalo de nuevo.', 'internal');
  }
}

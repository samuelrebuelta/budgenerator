import type { CallableRequest } from 'firebase-functions/v2/https';
import { runtimeConfig, type AppCheckMode } from '../core/config.js';
import { firestore } from '../core/firebase.js';
import { httpsError, logEvent } from '../core/observability.js';
import { clientFingerprint, enforceRateLimits, type RateLimitRule } from './rateLimit.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const tokenPattern = /^[A-Za-z0-9_-]{32}$/;

/**
 * App Check in observation mode: requests without a valid token are logged but
 * accepted. With `APP_CHECK_MODE=enforce` the callable option `enforceAppCheck`
 * already rejects them before the handler; this check is a second barrier.
 */
export function checkAppCheck(
  fn: string,
  request: Pick<CallableRequest, 'app'>,
  mode: AppCheckMode = runtimeConfig.appCheckMode,
) {
  if (mode === 'off' || request.app) return;
  logEvent('warn', 'app_check_missing', { fn, mode });
  if (mode === 'enforce')
    throw httpsError(
      'failed-precondition',
      'No se ha podido verificar la aplicación. Recarga la página.',
      'app_check_required',
    );
}

/** Limits per client network and a global daily ceiling for estimator reads. */
export function estimatorRules(fingerprint: string): RateLimitRule[] {
  const { limits } = runtimeConfig;
  return [
    {
      scope: 'estimator_ip',
      subject: fingerprint,
      limit: limits.estimatorPerIpPerMinute,
      windowMs: MINUTE_MS,
    },
    {
      scope: 'estimator_global',
      subject: 'global',
      limit: limits.estimatorGlobalPerDay,
      windowMs: DAY_MS,
    },
  ];
}

export function leadRules(fingerprint: string, ownerUid: string | null): RateLimitRule[] {
  const { limits } = runtimeConfig;
  return [
    {
      scope: 'lead_ip',
      subject: fingerprint,
      limit: limits.leadsPerIpPerHour,
      windowMs: HOUR_MS,
    },
    ...(ownerUid
      ? [
          {
            scope: 'lead_owner',
            subject: ownerUid,
            limit: limits.leadsPerOwnerPerDay,
            windowMs: DAY_MS,
          },
        ]
      : []),
    {
      scope: 'lead_global',
      subject: 'global',
      limit: limits.leadsGlobalPerDay,
      windowMs: DAY_MS,
    },
  ];
}

async function ownerForToken(token: unknown) {
  if (typeof token !== 'string' || !tokenPattern.test(token)) return null;
  const snapshot = await firestore.doc(`publicQuoteTokens/${token}`).get();
  const ownerUid = snapshot.get('ownerUid');
  return snapshot.get('active') === true && typeof ownerUid === 'string' ? ownerUid : null;
}

type PublicRequest = Pick<CallableRequest, 'app' | 'rawRequest' | 'data'>;

/** Runs before `getPublicEstimator` and `calculatePublicEstimate`. */
export async function guardPublicEstimatorCall(fn: string, request: PublicRequest) {
  checkAppCheck(fn, request);
  await enforceRateLimits(
    fn,
    estimatorRules(clientFingerprint(request.rawRequest)),
    'Se ha alcanzado el límite temporal de estimaciones. Prueba más tarde.',
  );
}

/**
 * Runs before `submitPublicLead`. The per-token hourly limit stays inside the
 * handler; these rules add per-network, per-owner daily and global daily caps.
 * Invalid payloads are rejected by the handler, but still count, so a bot that
 * floods with garbage is throttled as well.
 */
export async function guardPublicLeadCall(request: PublicRequest) {
  checkAppCheck('submitPublicLead', request);
  const token = (request.data as { token?: unknown } | null)?.token;
  const ownerUid = await ownerForToken(token);
  await enforceRateLimits(
    'submitPublicLead',
    leadRules(clientFingerprint(request.rawRequest), ownerUid),
    'Este formulario ha recibido varias solicitudes recientemente. Prueba más tarde.',
  );
}

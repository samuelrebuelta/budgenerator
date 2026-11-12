import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../core/firebase.js';
import { httpsError, logEvent } from '../core/observability.js';

/**
 * Fixed-window counters stored in `abuseRateLimits/{key}`. Each window lives in
 * its own document, so no reset logic is needed; `expiresAt` drives a Firestore
 * TTL policy (and the daily retention job as a fallback).
 *
 * The counters are approximate on purpose: they are read with `getAll` and
 * incremented atomically with `FieldValue.increment`, without a transaction,
 * to avoid contention on the global documents. Under a burst the limit can be
 * exceeded by the number of concurrent requests, which is acceptable for abuse
 * control. Subjects (IP, UID, token) are stored only as salted hashes.
 */
export const RATE_LIMIT_COLLECTION = 'abuseRateLimits';
const DAY_MS = 86_400_000;

export interface RateLimitRule {
  /** Stable scope name, e.g. `lead_ip`. Used in logs and metrics. */
  scope: string;
  /** Raw subject (IP, UID, token or `global`); hashed before storage. */
  subject: string;
  limit: number;
  windowMs: number;
}

export function subjectHash(subject: string) {
  return createHash('sha256').update(`bg-rate:${subject}`).digest('hex').slice(0, 32);
}

export function rateLimitDocId(rule: RateLimitRule, nowMs: number) {
  const window = Math.floor(nowMs / rule.windowMs);
  return `${rule.scope}_${subjectHash(rule.subject)}_${window}`;
}

/**
 * Returns the scope of the first exceeded rule, or `null` and consumes one unit
 * of every rule when all of them still have room.
 */
export async function consumeRateLimits(
  rules: RateLimitRule[],
  nowMs = Date.now(),
): Promise<string | null> {
  if (rules.length === 0) return null;
  const refs = rules.map((rule) =>
    firestore.collection(RATE_LIMIT_COLLECTION).doc(rateLimitDocId(rule, nowMs)),
  );
  const snapshots = await firestore.getAll(...refs);
  for (const [index, snapshot] of snapshots.entries()) {
    const rule = rules[index];
    const count = snapshot.get('count');
    if (rule && typeof count === 'number' && count >= rule.limit) return rule.scope;
  }
  const batch = firestore.batch();
  rules.forEach((rule, index) => {
    const ref = refs[index];
    if (!ref) return;
    const windowStart = Math.floor(nowMs / rule.windowMs) * rule.windowMs;
    batch.set(
      ref,
      {
        scope: rule.scope,
        count: FieldValue.increment(1),
        windowStartedAt: Timestamp.fromMillis(windowStart),
        expiresAt: Timestamp.fromMillis(windowStart + rule.windowMs + DAY_MS),
      },
      { merge: true },
    );
  });
  await batch.commit();
  return null;
}

/** Throws `resource-exhausted` with a uniform reason when a rule is exceeded. */
export async function enforceRateLimits(fn: string, rules: RateLimitRule[], message: string) {
  const exceeded = await consumeRateLimits(rules);
  if (exceeded) {
    logEvent('warn', 'rate_limit_exceeded', { fn, scope: exceeded });
    throw httpsError('resource-exhausted', message, 'rate_limited');
  }
}

interface RawRequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Client network identity used as a rate-limit subject. IPv6 addresses are
 * reduced to their /64 prefix, because a single client usually owns a whole /64.
 * The value is never stored or logged in clear text.
 */
export function clientFingerprint(rawRequest: RawRequestLike | undefined) {
  const forwarded = rawRequest?.headers?.['x-forwarded-for'];
  const header = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (header?.split(',')[0] ?? rawRequest?.ip ?? '').trim();
  if (!ip) return 'unknown';
  if (ip.includes(':') && !ip.startsWith('::ffff:')) {
    return `v6:${ip.split(':').slice(0, 4).join(':')}`;
  }
  return `v4:${ip.replace(/^::ffff:/, '')}`;
}

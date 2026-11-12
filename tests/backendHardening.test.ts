import { describe, expect, it, vi } from 'vitest';
import { readAppCheckMode } from '../functions/src/core/config';
import { checkAppCheck, leadRules } from '../functions/src/abuse/publicGuards';
import { clientFingerprint, rateLimitDocId } from '../functions/src/abuse/rateLimit';
import { requireRecentLogin, requireVerifiedEmail } from '../functions/src/core/auth';
import { httpsError, observe, pseudonym } from '../functions/src/core/observability';
import { buildPushMessage } from '../functions/src/notifications/fcm';
import { isStaleLeadEvent } from '../functions/src/notifications/leadCreated';
import { leadRetentionCutoff } from '../functions/src/retention/retention';
import { toJson } from '../functions/src/account/account';

const auth = (token: Record<string, unknown>) => ({
  auth: { uid: 'alice', token, rawToken: 'raw' },
});

describe('App Check modes', () => {
  it('defaults to observation and only accepts known modes', () => {
    expect(readAppCheckMode(undefined)).toBe('monitor');
    expect(readAppCheckMode('enforce')).toBe('enforce');
    expect(readAppCheckMode('off')).toBe('off');
    expect(readAppCheckMode('ENFORCE')).toBe('monitor');
  });

  it('logs but accepts missing tokens in monitor mode and rejects them when enforced', () => {
    expect(() => checkAppCheck('fn', { app: undefined }, 'monitor')).not.toThrow();
    expect(() => checkAppCheck('fn', { app: undefined }, 'off')).not.toThrow();
    expect(() => checkAppCheck('fn', { app: undefined }, 'enforce')).toThrow(
      expect.objectContaining({ details: { reason: 'app_check_required' } }),
    );
    expect(() =>
      checkAppCheck('fn', { app: { appId: 'a', token: {} as never } }, 'enforce'),
    ).not.toThrow();
  });
});

describe('rate limit keys', () => {
  it('derives a hashed, per-window document id', () => {
    const rule = { scope: 'lead_ip', subject: 'v4:198.51.100.7', limit: 1, windowMs: 60_000 };
    const id = rateLimitDocId(rule, 120_000);
    expect(id).toMatch(/^lead_ip_[0-9a-f]{32}_2$/);
    expect(id).not.toContain('198.51');
    expect(rateLimitDocId(rule, 179_999)).toBe(id);
    expect(rateLimitDocId(rule, 180_000)).not.toBe(id);
  });

  it('uses the first forwarded address and groups IPv6 by /64', () => {
    expect(clientFingerprint({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } })).toBe(
      'v4:203.0.113.9',
    );
    expect(clientFingerprint({ ip: '2001:db8:1:2:3:4:5:6' })).toBe('v6:2001:db8:1:2');
    expect(clientFingerprint({ ip: '::ffff:192.0.2.1' })).toBe('v4:192.0.2.1');
    expect(clientFingerprint(undefined)).toBe('unknown');
  });

  it('adds the owner daily cap only when the token resolves to an owner', () => {
    expect(leadRules('v4:1.1.1.1', null).map((rule) => rule.scope)).toEqual([
      'lead_ip',
      'lead_global',
    ]);
    expect(leadRules('v4:1.1.1.1', 'alice').map((rule) => rule.scope)).toContain('lead_owner');
  });
});

describe('auth guards', () => {
  it('requires a verified email to publish', () => {
    expect(requireVerifiedEmail(auth({ email_verified: true }))).toBe('alice');
    expect(() => requireVerifiedEmail(auth({ email_verified: false }))).toThrow(
      expect.objectContaining({ details: { reason: 'email_not_verified' } }),
    );
    expect(() => requireVerifiedEmail({ auth: undefined })).toThrow(
      expect.objectContaining({ code: 'unauthenticated' }),
    );
  });

  it('requires a sign-in within five minutes for destructive operations', () => {
    const now = 1_800_000_000_000;
    expect(requireRecentLogin(auth({ auth_time: now / 1000 - 60 }), now)).toBe('alice');
    expect(() => requireRecentLogin(auth({ auth_time: now / 1000 - 600 }), now)).toThrow(
      expect.objectContaining({ details: { reason: 'recent_login_required' } }),
    );
  });
});

describe('observability', () => {
  it('pseudonymises identifiers', () => {
    expect(pseudonym('alice')).toMatch(/^[0-9a-f]{12}$/);
    expect(pseudonym('alice')).not.toBe(pseudonym('bob'));
    expect(pseudonym(undefined)).toBe('none');
  });

  it('turns unexpected errors into a uniform internal error and keeps HttpsError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      observe('fn', () => Promise.reject(new Error('user alice@example.test failed'))),
    ).rejects.toMatchObject({ code: 'internal', details: { reason: 'internal' } });
    const expected = httpsError('not-found', 'Nope', 'internal');
    await expect(observe('fn', () => Promise.reject(expected))).rejects.toBe(expected);
    await expect(observe('fn', () => 42)).resolves.toBe(42);
  });
});

describe('push payload', () => {
  const base = { jobId: 'job', leadId: 'lead', registrationToken: 't'.repeat(40) };

  it('keeps web pushes data-only so the service worker shows a single notification', () => {
    const message = buildPushMessage(base);
    expect(message).toMatchObject({ token: base.registrationToken, webpush: {} });
    expect(message).not.toHaveProperty('notification');
  });

  it('adds notification, APNs and Android blocks for native devices', () => {
    for (const platform of ['ios', 'android'] as const) {
      const message = buildPushMessage({ ...base, platform });
      expect(message).toMatchObject({
        notification: { title: expect.any(String) },
        data: { leadId: 'lead', type: 'lead_created' },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      expect(JSON.stringify(message)).not.toContain('@');
    }
  });
});

describe('lead events and retention', () => {
  it('discards events older than the notification horizon', () => {
    const now = Date.parse('2026-11-12T12:00:00Z');
    expect(isStaleLeadEvent('2026-11-12T11:00:00Z', now)).toBe(false);
    expect(isStaleLeadEvent('2026-11-12T05:00:00Z', now)).toBe(true);
    expect(isStaleLeadEvent(undefined, now)).toBe(false);
  });

  it('computes the lead retention cutoff in months', () => {
    expect(leadRetentionCutoff(Date.parse('2026-11-12T00:00:00Z'), 12).toDate().toISOString()).toBe(
      '2025-11-12T00:00:00.000Z',
    );
  });

  it('serialises Firestore values to plain JSON for the export', () => {
    expect(toJson({ a: [1, 'b', null, { c: true }], d: undefined })).toEqual({
      a: [1, 'b', null, { c: true }],
      d: null,
    });
  });
});

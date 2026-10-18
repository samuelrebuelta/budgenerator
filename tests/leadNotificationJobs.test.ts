import { describe, expect, it } from 'vitest';
import { createNotificationJobId, isEnabledForLead } from '../functions/src/notifications/jobs';
import {
  calculateRetryDelayMs,
  MAX_NOTIFICATION_ATTEMPTS,
} from '../functions/src/notifications/worker';

const emailJob = {
  uid: 'owner-uid',
  leadId: 'lead-id',
  channel: 'email' as const,
};

describe('notification job identity and timing', () => {
  it('creates stable opaque identities per lead, channel and device', () => {
    const first = createNotificationJobId(emailJob);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(createNotificationJobId(emailJob)).toBe(first);
    expect(
      createNotificationJobId({ ...emailJob, channel: 'push', installationId: 'device-a' }),
    ).not.toBe(first);
    expect(
      createNotificationJobId({ ...emailJob, channel: 'push', installationId: 'device-a' }),
    ).not.toBe(
      createNotificationJobId({ ...emailJob, channel: 'push', installationId: 'device-b' }),
    );
  });

  it('does not notify for disabled channels or leads created before activation', () => {
    expect(isEnabledForLead(true, 1000, 1000)).toBe(true);
    expect(isEnabledForLead(true, 1001, 1000)).toBe(false);
    expect(isEnabledForLead(false, 500, 1000)).toBe(false);
    expect(isEnabledForLead(true, null, 1000)).toBe(false);
  });

  it('uses bounded exponential retry delays and stops after five attempts', () => {
    expect(MAX_NOTIFICATION_ATTEMPTS).toBe(5);
    expect(calculateRetryDelayMs(1, 0.5)).toBe(33_000);
    expect(calculateRetryDelayMs(2, 0.5)).toBe(66_000);
    expect(calculateRetryDelayMs(5, 0.5)).toBe(528_000);
    expect(() => calculateRetryDelayMs(6, 0.5)).toThrow();
  });
});

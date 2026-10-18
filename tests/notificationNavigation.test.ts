import { describe, expect, it } from 'vitest';
import {
  notificationPathFromLeadId,
  safeNotificationLoginReturnPath,
} from '../src/features/notifications/model/navigation';

describe('notification management navigation', () => {
  it('builds a same-origin request path from a safe lead ID', () => {
    expect(notificationPathFromLeadId('a'.repeat(64))).toBe(
      `/profile/solicitudes?leadId=${'a'.repeat(64)}`,
    );
    expect(notificationPathFromLeadId('../account')).toBeNull();
  });

  it('accepts only the own request route as a post-login destination', () => {
    expect(safeNotificationLoginReturnPath('/profile/solicitudes?leadId=lead-1')).toBe(
      '/profile/solicitudes?leadId=lead-1',
    );
    expect(
      safeNotificationLoginReturnPath(
        'https://budgenerator.web.app/profile/solicitudes?leadId=lead-1',
      ),
    ).toBeNull();
    expect(safeNotificationLoginReturnPath('//attacker.example')).toBeNull();
    expect(
      safeNotificationLoginReturnPath('/profile/solicitudes?leadId=lead-1&next=/admin'),
    ).toBeNull();
  });
});

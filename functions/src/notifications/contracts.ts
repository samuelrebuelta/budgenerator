import { HttpsError } from 'firebase-functions/v2/https';

export interface NotificationPreferences {
  pushEnabled: boolean;
}

export type PushDeviceRegistration =
  { installationId: string; fid: string } | { installationId: string; registrationToken: string };

export const MAX_PUSH_DEVICES = 10;
const installationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const visibleFidPattern = /^[A-Za-z0-9_-]+$/;

function isValidRegistrationToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 32 &&
    value.length <= 4096 &&
    !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        character.trim().length === 0 ||
        codePoint <= 0x1f ||
        (codePoint >= 0x7f && codePoint <= 0x9f)
      );
    })
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  const input = asRecord(value);
  const pushOnly = input && hasExactKeys(input, ['pushEnabled']);
  const legacyDisabledEmail =
    input && hasExactKeys(input, ['emailEnabled', 'pushEnabled']) && input.emailEnabled === false;
  if (!input || (!pushOnly && !legacyDisabledEmail) || typeof input.pushEnabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Las preferencias de notificación no son válidas.');
  }
  return { pushEnabled: input.pushEnabled };
}

export function parsePushDeviceRegistration(value: unknown): PushDeviceRegistration {
  const input = asRecord(value);
  if (
    !input ||
    typeof input.installationId !== 'string' ||
    !installationIdPattern.test(input.installationId)
  ) {
    throw new HttpsError('invalid-argument', 'El dispositivo push no es válido.');
  }
  if (
    hasExactKeys(input, ['installationId', 'fid']) &&
    typeof input.fid === 'string' &&
    input.fid.length >= 16 &&
    input.fid.length <= 128 &&
    visibleFidPattern.test(input.fid)
  ) {
    return { installationId: input.installationId, fid: input.fid };
  }
  if (
    hasExactKeys(input, ['installationId', 'registrationToken']) &&
    isValidRegistrationToken(input.registrationToken)
  ) {
    return { installationId: input.installationId, registrationToken: input.registrationToken };
  }
  throw new HttpsError('invalid-argument', 'El dispositivo push no es válido.');
}

export function parsePushDeviceId(value: unknown): string {
  if (typeof value !== 'string' || !installationIdPattern.test(value)) {
    throw new HttpsError('invalid-argument', 'El dispositivo push no es válido.');
  }
  return value;
}

export function requireNotificationOwnerUid(uid: string | undefined) {
  if (!uid)
    throw new HttpsError('unauthenticated', 'Inicia sesión para gestionar las notificaciones.');
  return uid;
}

export function canRegisterPushDevice(deviceCount: number, alreadyRegistered: boolean) {
  if (!Number.isInteger(deviceCount) || deviceCount < 0) return false;
  return alreadyRegistered || deviceCount < MAX_PUSH_DEVICES;
}

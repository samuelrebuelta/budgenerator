import { HttpsError } from 'firebase-functions/v2/https';

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
}

export interface PushDeviceRegistration {
  installationId: string;
  token: string;
}

export const MAX_PUSH_DEVICES = 10;
const installationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const visibleTokenPattern = /^[\x21-\x7e]+$/;

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
  if (
    !input ||
    !hasExactKeys(input, ['emailEnabled', 'pushEnabled']) ||
    typeof input.emailEnabled !== 'boolean' ||
    typeof input.pushEnabled !== 'boolean'
  ) {
    throw new HttpsError('invalid-argument', 'Las preferencias de notificación no son válidas.');
  }
  return { emailEnabled: input.emailEnabled, pushEnabled: input.pushEnabled };
}

export function parsePushDeviceRegistration(value: unknown): PushDeviceRegistration {
  const input = asRecord(value);
  if (
    !input ||
    !hasExactKeys(input, ['installationId', 'token']) ||
    typeof input.installationId !== 'string' ||
    !installationIdPattern.test(input.installationId) ||
    typeof input.token !== 'string' ||
    input.token.length < 20 ||
    input.token.length > 4096 ||
    !visibleTokenPattern.test(input.token)
  ) {
    throw new HttpsError('invalid-argument', 'El dispositivo push no es válido.');
  }
  return { installationId: input.installationId, token: input.token };
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

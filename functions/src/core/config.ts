/**
 * Runtime configuration shared by every Cloud Function.
 *
 * Values come from `functions/.env` (versioned, no secrets) and can be
 * overridden per project with `functions/.env.<projectId>` or `.env.local`
 * in the emulator. They are read once when the module loads, so a change
 * requires a redeploy.
 */

/** Same region as the Firestore database (`europe-southwest1`, Madrid). */
export const FUNCTION_REGION = 'europe-southwest1';

export type AppCheckMode = 'off' | 'monitor' | 'enforce';

function readInt(name: string, fallback: number, min = 1, max = 1_000_000) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
}

export function readAppCheckMode(value = process.env.APP_CHECK_MODE): AppCheckMode {
  return value === 'off' || value === 'enforce' ? value : 'monitor';
}

export const runtimeConfig = {
  appCheckMode: readAppCheckMode(),
  /** Leads older than this are anonymized by the daily retention job. */
  leadRetentionMonths: readInt('LEAD_RETENTION_MONTHS', 12, 1, 120),
  /** Push devices without activity for this long are deleted. */
  pushDeviceInactiveDays: readInt('PUSH_DEVICE_INACTIVE_DAYS', 270, 30, 3650),
  /** Devices waiting for a new token (`recoveryRequired`) are deleted after this. */
  pushDeviceRecoveryDays: readInt('PUSH_DEVICE_RECOVERY_DAYS', 60, 1, 3650),
  limits: {
    estimatorPerIpPerMinute: readInt('LIMIT_ESTIMATOR_PER_IP_PER_MINUTE', 60),
    estimatorGlobalPerDay: readInt('LIMIT_ESTIMATOR_GLOBAL_PER_DAY', 20_000),
    leadsPerIpPerHour: readInt('LIMIT_LEADS_PER_IP_PER_HOUR', 10),
    /** All visitors of one public form together; per-IP and per-owner limits stop abuse. */
    leadsPerFormPerHour: readInt('LIMIT_LEADS_PER_FORM_PER_HOUR', 60),
    leadsPerOwnerPerDay: readInt('LIMIT_LEADS_PER_OWNER_PER_DAY', 50),
    leadsGlobalPerDay: readInt('LIMIT_LEADS_GLOBAL_PER_DAY', 500),
    leadPushPerOwnerPerHour: readInt('LIMIT_LEAD_PUSH_PER_OWNER_PER_HOUR', 5),
  },
} as const;

const base = {
  region: FUNCTION_REGION,
  minInstances: 0,
  memory: '256MiB',
} as const;

/** Public callables (anonymous visitors of the public estimator). */
export const publicCallableOptions = {
  ...base,
  invoker: 'public',
  maxInstances: 10,
  timeoutSeconds: 15,
  concurrency: 80,
  enforceAppCheck: runtimeConfig.appCheckMode === 'enforce',
} as const;

/** Callables that require a Firebase Auth session; the handler checks the UID. */
export const authCallableOptions = {
  ...base,
  invoker: 'public',
  maxInstances: 10,
  timeoutSeconds: 30,
  concurrency: 80,
} as const;

/** Account deletion and export walk the whole user tree. */
export const accountCallableOptions = {
  ...base,
  invoker: 'public',
  maxInstances: 5,
  memory: '512MiB',
  timeoutSeconds: 300,
  concurrency: 10,
} as const;

export const triggerOptions = {
  ...base,
  maxInstances: 10,
  timeoutSeconds: 60,
} as const;

export const scheduleOptions = {
  ...base,
  maxInstances: 1,
  timeoutSeconds: 540,
  timeZone: 'Europe/Madrid',
} as const;

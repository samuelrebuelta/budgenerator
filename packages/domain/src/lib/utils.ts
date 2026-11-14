import { formatEuros } from './format.js';

export const CONTACT_EMAIL = 'budgenerator@gmail.com';
export const FREE_BUDGET_LIMIT = 3;
export const MAX_LOGO_SIZE = 500 * 1024;

export function getBudgetSlotsUsed(totalBudgetsCreated: number) {
  return Math.max(0, totalBudgetsCreated);
}

/** @deprecated Use `formatEuros` from `@bg/domain/lib/format`. */
export function formatCurrency(value: number): string {
  return formatEuros(value);
}

/** Source of random UUIDs. React Native installs one (e.g. `expo-crypto`) with `setIdGenerator`. */
let idGenerator: (() => string) | undefined;

/** Replaces the UUID source; pass `undefined` to go back to `globalThis.crypto.randomUUID`. */
export function setIdGenerator(generator: (() => string) | undefined) {
  idGenerator = generator;
}

export function generateId(): string {
  if (idGenerator) return idGenerator();
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto);
  throw new Error(
    'No hay generador de identificadores: llama a setIdGenerator en esta plataforma.',
  );
}

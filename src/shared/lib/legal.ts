/**
 * Version of the conditions and privacy policy accepted at registration. Bump it
 * whenever `src/pages/legal/legalContent.ts` changes in substance.
 */
export const LEGAL_TERMS_VERSION = '2026-11';

let pendingAcceptance: string | null = null;

/**
 * Registration happens before the account document exists: the login form marks
 * the acceptance here and the user store writes it, with the server time, when
 * it creates `users/{uid}`.
 */
export function markLegalAcceptance(version = LEGAL_TERMS_VERSION) {
  pendingAcceptance = version;
}

export function takeLegalAcceptance() {
  const version = pendingAcceptance;
  pendingAcceptance = null;
  return version;
}

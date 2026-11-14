import { Platform, Share } from 'react-native';
import type { BudgetRecord } from '@bg/domain/budget/record';
import type { CompanyProfile } from '@bg/domain/types';
import { PUBLIC_WEB_ORIGIN } from '../../platform/webLinks';

/** Public viewer of the web (`/shared/:token`); it stays web-only (BG-014, «Se queda sólo en web»). */
export function publicBudgetUrl(token: string) {
  return `${PUBLIC_WEB_ORIGIN}/shared/${token}`;
}

export interface PublicLinkDeps {
  /** Reloads the user and says whether the email is verified (Rules require it to share). */
  refreshVerification: () => Promise<boolean>;
  /**
   * `shareBudget` of `@bg/firebase-api`: it writes the public DTO (`buildSharedBudget`, allowlisted
   * business fields and public FIEBDC content, never the private record) to `sharedBudgets/{token}`.
   */
  shareBudget: (record: BudgetRecord, company: CompanyProfile) => Promise<string>;
}

export type PublicLinkResult =
  { status: 'unverified' } | { status: 'shared'; token: string; url: string };

/**
 * «Crear enlace público» of the web's `ShareButton`: requires a verified email, creates the
 * 30-day snapshot and opens the native share sheet with the link (instead of `navigator.share`).
 */
export async function createPublicLink(
  record: BudgetRecord,
  company: CompanyProfile,
  deps: PublicLinkDeps,
): Promise<PublicLinkResult> {
  if (!(await deps.refreshVerification())) return { status: 'unverified' };
  const token = await deps.shareBudget(record, company);
  const url = publicBudgetUrl(token);
  const title = company.name || 'Presupuesto · budgenerator';
  // iOS shares `url` as a link item; Android only shares text, so the link goes in `message`.
  await Share.share(Platform.OS === 'ios' ? { title, url } : { title, message: url }, {
    dialogTitle: 'Compartir enlace del presupuesto',
    subject: 'Presupuesto',
  });
  return { status: 'shared', token, url };
}

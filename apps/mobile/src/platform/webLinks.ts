import { Linking } from 'react-native';

/**
 * Public web of BudGenerator (same origin as `PUBLIC_APP_ORIGIN` in Functions). The legal texts
 * stay on the web (BG-014, «Se queda sólo en web») and open in the system browser.
 */
export const PUBLIC_WEB_ORIGIN = 'https://budgenerator.web.app';

export type LegalDocumentId = 'condiciones' | 'privacidad' | 'aviso-legal' | 'cookies';

export function legalDocumentUrl(id: LegalDocumentId): string {
  return `${PUBLIC_WEB_ORIGIN}/legal/${id}`;
}

/** Opens a legal text of the web in the system browser. */
export function openLegalDocument(id: LegalDocumentId): Promise<void> {
  return Linking.openURL(legalDocumentUrl(id));
}

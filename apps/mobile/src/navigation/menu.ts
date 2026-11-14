import type { IconName } from '../ui/Icon';

/**
 * Entries of the account menu with the web's labels and order (`COMPANY_LINKS`,
 * `ACCOUNT_LINKS`). Only «Mi cuenta» exists in this delivery; the rest are placeholders.
 */
export const MENU_SECTIONS = [
  { id: 'profile', title: 'Mi empresa', icon: 'home' },
  { id: 'catalog', title: 'Catálogo', icon: 'book-open' },
  { id: 'templates', title: 'Plantillas de presupuestos', icon: 'layout' },
  { id: 'estimator', title: 'Estimador público', icon: 'grid' },
  { id: 'account', title: 'Mi cuenta', icon: 'user' },
  { id: 'help', title: 'Ayuda', icon: 'help-circle' },
] as const satisfies readonly { id: string; title: string; icon: IconName }[];

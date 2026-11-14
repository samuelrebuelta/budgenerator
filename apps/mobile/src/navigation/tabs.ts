import type { IconName } from '../ui/Icon';

/** Tab order and icons of the web (`src/app/navigation.ts`, lucide → Feather). Each tab has its own stack. */
export const TAB_SCREENS = [
  { name: 'budgets', title: 'Presupuestos', icon: 'file-text' },
  { name: 'projects', title: 'Proyectos', icon: 'briefcase' },
  { name: 'team', title: 'Equipo', icon: 'users' },
  { name: 'leads', title: 'Solicitudes', icon: 'inbox' },
] as const satisfies readonly { name: string; title: string; icon: IconName }[];

export type TabName = (typeof TAB_SCREENS)[number]['name'];

/** D8: the first time (or after a sign-out wiped the account's storage) the app opens here. */
export const DEFAULT_TAB: TabName = 'budgets';

export function isTabName(value: unknown): value is TabName {
  return TAB_SCREENS.some((tab) => tab.name === value);
}

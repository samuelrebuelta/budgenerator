import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/**
 * Tab order of the web (`src/app/navigation.ts`). Each tab has its own stack. Icons are the
 * system's: SF Symbols on iOS (outline, filled when selected, as the HIG asks) and Material
 * Symbols on Android, equivalent to the web's lucide icons.
 */
export const TAB_SCREENS = [
  {
    name: 'budgets',
    title: 'Presupuestos',
    sf: { default: 'doc.text', selected: 'doc.text.fill' },
    md: 'description',
  },
  {
    name: 'projects',
    title: 'Proyectos',
    sf: { default: 'briefcase', selected: 'briefcase.fill' },
    md: 'work',
  },
  {
    name: 'team',
    title: 'Equipo',
    sf: { default: 'person.2', selected: 'person.2.fill' },
    md: 'group',
  },
  {
    name: 'leads',
    title: 'Solicitudes',
    sf: { default: 'tray', selected: 'tray.fill' },
    md: 'inbox',
  },
] as const satisfies readonly {
  name: string;
  title: string;
  sf: { default: SFSymbol; selected: SFSymbol };
  md: AndroidSymbol;
}[];

export type TabName = (typeof TAB_SCREENS)[number]['name'];

/** D8: the first time (or after a sign-out wiped the account's storage) the app opens here. */
export const DEFAULT_TAB: TabName = 'budgets';

export function isTabName(value: unknown): value is TabName {
  return TAB_SCREENS.some((tab) => tab.name === value);
}

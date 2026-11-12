import {
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  CircleHelp,
  CircleUserRound,
  FileText,
  Inbox,
  LayoutTemplate,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Root tabs: side navigation on desktop, bottom bar below 801 px. */
export const PRIMARY_TABS: NavigationLink[] = [
  { to: '/budgets', label: 'Presupuestos', icon: FileText },
  { to: '/projects', label: 'Proyectos', icon: Briefcase },
  { to: '/team', label: 'Equipo', icon: UsersRound },
  { to: '/profile/solicitudes', label: 'Solicitudes', icon: Inbox },
];

export const ADMIN_LINK: NavigationLink = {
  to: '/admin',
  label: 'Panel de administración',
  icon: ShieldCheck,
};

export const COMPANY_LINKS: NavigationLink[] = [
  { to: '/profile', label: 'Mi empresa', icon: Building2 },
  { to: '/catalog', label: 'Catálogo', icon: BookOpen },
  { to: '/templates', label: 'Plantillas de presupuestos', icon: LayoutTemplate },
  { to: '/estimator', label: 'Estimador público', icon: Calculator },
];

export const ACCOUNT_LINKS: NavigationLink[] = [
  { to: '/account', label: 'Mi cuenta', icon: CircleUserRound },
  { to: '/help', label: 'Ayuda', icon: CircleHelp },
];

function normalize(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}

/** Root tab that owns a path (`/budget/:id` belongs to Presupuestos). */
export function activeTabFor(pathname: string): string | undefined {
  return PRIMARY_TABS.find(
    ({ to }) =>
      pathname === to ||
      pathname.startsWith(`${to}/`) ||
      (to === '/budgets' && pathname.startsWith('/budget/')),
  )?.to;
}

export function isPrimaryTab(pathname: string): boolean {
  return PRIMARY_TABS.some(({ to }) => normalize(pathname) === to);
}

const SECTION_TITLES: [prefix: string, title: string][] = [
  ['/account', 'Mi cuenta'],
  ['/profile', 'Mi empresa'],
  ['/catalog', 'Catálogo'],
  ['/help', 'Ayuda'],
  ['/templates', 'Plantillas de presupuestos'],
  ['/estimator', 'Estimador público'],
  ['/admin', 'Panel de administración'],
];

/** Section name shown in the desktop header. */
export function sectionTitle(pathname: string): string {
  const tab = activeTabFor(pathname);
  if (tab) return PRIMARY_TABS.find(({ to }) => to === tab)!.label;
  const path = normalize(pathname);
  return (
    SECTION_TITLES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ??
    'BudGenerator'
  );
}

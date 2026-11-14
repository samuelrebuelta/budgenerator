/** Tab order of the web (docs/architecture.md). Each tab has its own stack. */
export const TAB_SCREENS = [
  { name: 'budgets', title: 'Presupuestos' },
  { name: 'projects', title: 'Proyectos' },
  { name: 'team', title: 'Equipo' },
  { name: 'leads', title: 'Solicitudes' },
] as const;

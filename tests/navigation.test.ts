import { describe, expect, it } from 'vitest';
import { activeTabFor, isPrimaryTab, sectionTitle } from '../src/app/navigation';

describe('app navigation', () => {
  it('maps paths to their root tab and header title', () => {
    expect(activeTabFor('/budget/abc')).toBe('/budgets');
    expect(activeTabFor('/team/manage')).toBe('/team');
    expect(activeTabFor('/catalog')).toBeUndefined();
    expect(sectionTitle('/team/jobs/new')).toBe('Equipo');
    expect(sectionTitle('/profile')).toBe('Mi empresa');
    expect(sectionTitle('/profile/solicitudes')).toBe('Solicitudes');
    expect(sectionTitle('/catalog/')).toBe('Catálogo');
    expect(sectionTitle('/unknown')).toBe('BudGenerator');
  });

  it('distinguishes root tabs from secondary pages', () => {
    expect(isPrimaryTab('/projects/')).toBe(true);
    expect(isPrimaryTab('/projects/p1')).toBe(false);
  });
});

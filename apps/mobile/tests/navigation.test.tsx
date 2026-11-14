import { renderRouter, screen } from 'expo-router/testing-library';
import { TAB_SCREENS } from '../src/navigation/tabs';
import { setMockUser } from './helpers';

describe('navegación', () => {
  it('muestra las cuatro tabs en el orden de la web y abre Presupuestos con sesión', async () => {
    setMockUser({ uid: 'u1' });
    await renderRouter('./app', { initialUrl: '/' });

    expect(screen).toHavePathname('/budgets');
    expect(TAB_SCREENS.map((tab) => tab.title)).toEqual([
      'Presupuestos',
      'Proyectos',
      'Equipo',
      'Solicitudes',
    ]);
    // The tab bar announces each item with its position, so this also checks the order.
    TAB_SCREENS.forEach((tab, index) => {
      expect(screen.getByLabelText(`${tab.title}, tab, ${index + 1} of 4`)).toBeOnTheScreen();
    });
    expect(screen.getByRole('header', { name: 'Presupuestos' })).toBeOnTheScreen();
  });

  it('lleva al login sin sesión y protege las rutas de la app', async () => {
    setMockUser(null);
    await renderRouter('./app', { initialUrl: '/projects' });

    expect(screen).toHavePathname('/login');
    expect(screen.getByText('Inicia sesión')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });
});

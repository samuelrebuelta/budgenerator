import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { coordinator, repositories, useAuthStore } from '../src/state/stores';
import { LAST_TAB_KEY, readLastTab } from '../src/navigation/lastTab';
import { TAB_SCREENS } from '../src/navigation/tabs';
import { userStorage } from '../src/platform/userStorage';
import { setMockUser } from './helpers';

beforeEach(() => {
  coordinator.resetSession(null);
  useAuthStore.setState({ user: null, loading: true, error: null, emailVerified: false });
});

describe('guard de sesión (equivalente a AuthGuard)', () => {
  it('lleva al login sin sesión y protege las rutas de la app', async () => {
    setMockUser(null);
    await renderRouter('./app', { initialUrl: '/projects' });

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.getByRole('header', { name: 'Iniciar sesión' })).toBeOnTheScreen();
    expect(screen.queryByTestId('projects-placeholder')).toBeNull();
  });

  it('no abre las tabs hasta que el coordinador tiene la sesión lista y permite reintentar', async () => {
    const fetchBudgets = repositories.budget.fetchBudgets as jest.Mock;
    fetchBudgets.mockRejectedValueOnce(new Error('permission-denied'));
    setMockUser({ uid: 'guard-error' });
    await renderRouter('./app', { initialUrl: '/' });

    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.queryByTestId('budgets-placeholder')).toBeNull();

    await fireEvent.press(retry);
    expect(await screen.findByTestId('budgets-placeholder')).toBeOnTheScreen();
  });
});

describe('tabs y D8', () => {
  it('muestra las cuatro tabs con icono en el orden de la web y abre Presupuestos la primera vez', async () => {
    setMockUser({ uid: 'first-time' });
    await renderRouter('./app', { initialUrl: '/' });

    expect(await screen.findByTestId('budgets-placeholder')).toBeOnTheScreen();
    expect(screen).toHavePathname('/budgets');
    // The tab bar announces each item with its position, so this also checks the order.
    TAB_SCREENS.forEach((tab, index) => {
      expect(screen.getByLabelText(`${tab.title}, tab, ${index + 1} of 4`)).toBeOnTheScreen();
    });
    expect(screen.getByRole('button', { name: 'Menú de la cuenta' })).toBeOnTheScreen();
  });

  it('guarda la última tab en el MMKV del UID y vuelve a abrir en ella', async () => {
    setMockUser({ uid: 'returning' });
    const { unmount } = await renderRouter('./app', { initialUrl: '/' });
    await screen.findByTestId('budgets-placeholder');

    await fireEvent.press(screen.getByLabelText('Equipo, tab, 3 of 4'));
    expect(await screen.findByTestId('team-placeholder')).toBeOnTheScreen();
    expect(userStorage('returning').getString(LAST_TAB_KEY)).toBe('team');
    expect(readLastTab('returning')).toBe('team');
    expect(readLastTab('another-account')).toBe('budgets');
    unmount();

    // Next launch.
    await act(async () => {
      await renderRouter('./app', { initialUrl: '/' });
    });
    expect(await screen.findByTestId('team-placeholder')).toBeOnTheScreen();
    expect(screen).toHavePathname('/team');
  });
});

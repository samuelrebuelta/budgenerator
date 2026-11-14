import { Alert, Linking } from 'react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { LEGAL_TERMS_VERSION } from '@bg/domain/lib/legal';
import * as sessionReset from '../src/platform/sessionReset';
import { userStorage } from '../src/platform/userStorage';
import { LAST_TAB_KEY } from '../src/navigation/lastTab';
import { coordinator, repositories, useAuthStore } from '../src/state/stores';
import { setMockUser } from './helpers';

beforeEach(() => {
  coordinator.resetSession(null);
  useAuthStore.setState({ user: null, loading: true, error: null, emailVerified: false });
  jest.clearAllMocks();
});

const STRONG_PASSWORD = 'Reforma2026';

describe('registro', () => {
  it('exige aceptar las condiciones y guarda la versión aceptada al crear la cuenta', async () => {
    setMockUser(null);
    await renderRouter('./app', { initialUrl: '/register' });

    await fireEvent.changeText(await screen.findByLabelText('Email'), 'ana@example.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), STRONG_PASSWORD);
    const submit = screen.getByRole('button', { name: 'Registrarse' });
    expect(submit).toBeDisabled();

    // The legal texts open on the web in the system browser.
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await fireEvent.press(screen.getByText('condiciones de uso'));
    expect(openURL).toHaveBeenCalledWith('https://budgenerator.web.app/legal/condiciones');

    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'He leído y acepto las condiciones de uso y la política de privacidad',
      }),
    );
    expect(submit).toBeEnabled();
    await fireEvent.press(submit);

    await waitFor(() =>
      expect(repositories.auth.signUpWithEmail).toHaveBeenCalledWith(
        'ana@example.com',
        STRONG_PASSWORD,
      ),
    );
    expect(await screen.findByTestId('email-verification-notice')).toBeOnTheScreen();
    expect(repositories.user.saveUserData).toHaveBeenCalledWith(
      'new-ana',
      expect.objectContaining({ uid: 'new-ana', email: 'ana@example.com' }),
      LEGAL_TERMS_VERSION,
    );
  });

  it('no deja registrarse con una contraseña que no cumple los requisitos', async () => {
    setMockUser(null);
    await renderRouter('./app', { initialUrl: '/register' });

    await fireEvent.changeText(await screen.findByLabelText('Email'), 'ana@example.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'corta');
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Registrarse' })).toBeDisabled();
    expect(screen.getByLabelText('Mínimo 8 caracteres: pendiente')).toBeOnTheScreen();
  });
});

describe('login', () => {
  it('muestra los mensajes de error de la web', async () => {
    setMockUser(null);
    (repositories.auth.signInWithEmail as jest.Mock).mockRejectedValueOnce({
      code: 'auth/invalid-credential',
    });
    await renderRouter('./app', { initialUrl: '/login' });

    await fireEvent.changeText(await screen.findByLabelText('Email'), 'ana@example.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'mala');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Email o contraseña incorrectos')).toBeOnTheScreen();
    expect(screen).toHavePathname('/login');
  });
});

describe('recuperar contraseña', () => {
  it('envía el enlace al email del login y muestra los textos de la web', async () => {
    setMockUser(null);
    await renderRouter('./app', { initialUrl: '/login' });
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'ana@example.com');
    await fireEvent.press(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));

    expect(await screen.findByLabelText('Email')).toHaveDisplayValue('ana@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(repositories.auth.sendPasswordReset).toHaveBeenCalledWith('ana@example.com');
    expect(
      await screen.findByText(
        'Se ha enviado un email con instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada.',
      ),
    ).toBeOnTheScreen();
  });
});

describe('cerrar sesión (D3)', () => {
  it('borra la cuenta del dispositivo con resetSession y vuelve al login', async () => {
    const reset = jest.spyOn(sessionReset, 'resetSession');
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    setMockUser({ uid: 'leaving' });
    await renderRouter('./app', { initialUrl: '/' });
    await screen.findByTestId('budgets-placeholder');
    expect(userStorage('leaving').getString(LAST_TAB_KEY)).toBe('budgets');

    // Every tab stack has its header mounted; the first account button is Presupuestos'.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Menú de la cuenta' })[0]!);
    await fireEvent.press(await screen.findByRole('button', { name: 'Mi cuenta' }));
    expect(await screen.findByTestId('account-email')).toHaveTextContent('leaving@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(reset).toHaveBeenCalledWith('leaving');
    // MMKV of the UID (last tab included) is gone.
    expect(userStorage('leaving').getString(LAST_TAB_KEY)).toBeUndefined();
  });
});

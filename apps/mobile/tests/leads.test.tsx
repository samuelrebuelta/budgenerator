import { Alert, Linking, type AlertButton } from 'react-native';
import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { setNetworkOnline } from '@bg/app-core/network';
import { toastStore } from '@bg/app-core/toast';
import { formatCents } from '@bg/domain';
import type { BudgetRecord } from '@bg/domain/budget/record';
import type { QuoteLead } from '@bg/domain/quote-estimator/types';
import { budgetView } from '@bg/domain/budget/record';
import { router } from 'expo-router';
import { filterLeads, leadIdFromDeepLink, whatsappUrl } from '../src/features/leads/model';
import { leadRouteFromPushData } from '../src/platform/push';
import { coordinator, repositories, useAuthStore, useBudgetStore } from '../src/state/stores';
import { setMockUser } from './helpers';
import { budgetRecord, user } from '../../../packages/domain/tests/fixtures';

const mocked = <T,>(fn: T) => fn as unknown as jest.Mock;

function lead(id: string, patch: Partial<QuoteLead> = {}): QuoteLead {
  return {
    id,
    schemaVersion: 2,
    contact: { name: 'Lucía Prueba', email: 'lucia@example.com', phone: '600 111 222' },
    selections: [
      {
        room: 'bathroom',
        scope: 'integral',
        quality: 'high',
        areaM2: 6,
        instanceId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      },
      { room: 'kitchen', scope: 'partial', quality: 'medium', areaM2: 12 },
    ],
    startTiming: 'oneToThreeMonths',
    estimate: { minimumCents: 1_250_000, maximumCents: 1_800_000, lines: [] } as never,
    createdAt: '2026-11-10T09:30:00.000Z',
    consentAt: '2026-11-10T09:30:00.000Z',
    privacyPolicyUrl: 'https://example.com/privacidad',
    ...patch,
  };
}

async function openApp(
  url: string,
  { leads = [] as QuoteLead[], records = [] as BudgetRecord[] } = {},
) {
  mocked(repositories.user.fetchUserData).mockResolvedValue(user('ana'));
  mocked(repositories.budget.fetchBudgets).mockResolvedValue(records);
  mocked(repositories.quoteEstimator.fetchLeads).mockResolvedValue(leads);
  mocked(repositories.quoteEstimator.fetchLead).mockImplementation(
    async (_uid: string, id: string) => leads.find((item) => item.id === id) ?? null,
  );
  setMockUser({ uid: 'ana' });
  await renderRouter('./app', { initialUrl: url });
}

function answerAlerts(label: string) {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons?: AlertButton[]) =>
      buttons?.find((button) => button.text === label)?.onPress?.(),
    );
}

beforeEach(() => {
  coordinator.resetSession(null);
  useAuthStore.setState({ user: null, loading: true, error: null, emailVerified: false });
  jest.clearAllMocks();
  jest.restoreAllMocks();
  setNetworkOnline(true);
  toastStore.setState({ toast: null, offlineNoticeShown: false });
});

describe('lista de solicitudes', () => {
  it('muestra las solicitudes de la más reciente a la más antigua, busca y filtra', async () => {
    const older = lead('l1', { createdAt: '2026-11-01T10:00:00.000Z' });
    const newer = lead('l2', {
      contact: { name: 'Mario Ejemplo', email: 'mario@example.com', phone: '+34 611 222 333' },
      createdAt: '2026-11-12T10:00:00.000Z',
      budgetId: 'b1',
    });
    await openApp('/leads', { leads: [older, newer] });

    const first = await screen.findByTestId('lead-row-l1');
    expect(within(first).getByText('Lucía Prueba')).toBeOnTheScreen();
    expect(within(first).getByText('Baño 1 · Reforma integral · Calidad alta · 6 m² y 1 más'));
    expect(first.props.accessibilityLabel).toContain(formatCents(1_250_000));
    const rows = screen.getAllByTestId(/^lead-row-/).map((row) => row.props.testID);
    expect(rows).toEqual(['lead-row-l2', 'lead-row-l1']);
    expect(within(screen.getByTestId('lead-row-l2')).getByLabelText('Estado: Presupuesto creado'));

    await fireEvent.press(screen.getByTestId('leads-filter-pending'));
    expect(screen.queryByTestId('lead-row-l2')).toBeNull();
    expect(screen.getByTestId('lead-row-l1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('leads-filter-budgeted'));
    expect(screen.queryByTestId('lead-row-l1')).toBeNull();
    expect(screen.getByTestId('lead-row-l2')).toBeOnTheScreen();
  });

  it('muestra el estado vacío con acceso al estimador y el aviso sin conexión', async () => {
    await openApp('/leads');
    expect(await screen.findByText('Aún no has recibido solicitudes')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Configurar formulario de solicitudes' }),
    ).toBeOnTheScreen();

    await act(async () => setNetworkOnline(false));
    expect(screen.getByTestId('leads-offline-notice')).toBeOnTheScreen();
  });

  it('muestra el error de carga con «Reintentar»', async () => {
    mocked(repositories.quoteEstimator.fetchLeads).mockRejectedValueOnce(
      Object.assign(new Error('internal'), { code: 'internal' }),
    );
    mocked(repositories.user.fetchUserData).mockResolvedValue(user('ana'));
    setMockUser({ uid: 'ana' });
    await renderRouter('./app', { initialUrl: '/leads' });
    expect(await screen.findByTestId('leads-error')).toHaveTextContent(
      /No se han podido cargar las solicitudes/,
    );
    mocked(repositories.quoteEstimator.fetchLeads).mockResolvedValue([lead('l1')]);
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('lead-row-l1')).toBeOnTheScreen();
  });
});

describe('detalle de la solicitud', () => {
  it('muestra los datos del lead y abre teléfono, WhatsApp y email con Linking', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openApp('/leads', { leads: [lead('l1')] });
    await fireEvent.press(await screen.findByTestId('lead-row-l1'));

    expect(await screen.findByTestId('lead-name')).toHaveTextContent('Lucía Prueba');
    expect(screen.getByTestId('lead-selections')).toHaveTextContent(
      /Baño 1 · Reforma integral · Calidad alta · 6 m²/,
    );
    expect(screen.getByTestId('lead-selections')).toHaveTextContent(
      /Cocina · Reforma parcial · Calidad media · 12 m²/,
    );
    expect(screen.getByTestId('lead-start-timing')).toHaveTextContent(
      'Inicio previsto: En 1–3 meses',
    );
    // toHaveTextContent normalises the non-breaking spaces of the euro format.
    const range = `${formatCents(1_250_000)} – ${formatCents(1_800_000)} sin IVA`;
    expect(screen.getByTestId('lead-range')).toHaveTextContent(range.replace(/\s+/g, ' '));

    await fireEvent.press(screen.getByTestId('lead-call'));
    await fireEvent.press(screen.getByTestId('lead-whatsapp'));
    await fireEvent.press(screen.getByTestId('lead-email'));
    expect(openURL.mock.calls.map(([url]) => url)).toEqual([
      'tel:600111222',
      'https://wa.me/34600111222',
      'mailto:lucia@example.com',
    ]);
  });

  it('crea un presupuesto desde la solicitud enlazado con sourceLeadId', async () => {
    await openApp('/leads/l1', { leads: [lead('l1')] });
    await fireEvent.press(await screen.findByTestId('lead-create-budget'));

    await waitFor(() => expect(screen).toHavePathname('/budgets/new'));
    const draft = useBudgetStore.getState().draft!;
    expect(draft.sourceLeadId).toBe('l1');
    expect(budgetView(draft).info.clientName).toBe('Lucía Prueba');
  });

  it('abre el presupuesto enlazado cuando ya existe', async () => {
    await openApp('/leads/l1', {
      leads: [lead('l1', { budgetId: 'b1' })],
      records: [budgetRecord('b1')],
    });
    await fireEvent.press(await screen.findByTestId('lead-open-budget'));
    await waitFor(() => expect(screen).toHavePathname('/budgets/b1'));
  });

  it('borra la solicitud tras confirmar y vuelve a la lista', async () => {
    answerAlerts('Borrar');
    const leads = [lead('l1'), lead('l2')];
    await openApp('/leads', { leads });
    mocked(repositories.quoteEstimator.deleteLead).mockImplementation(
      async (_uid: string, id: string) => {
        leads.splice(
          leads.findIndex((item) => item.id === id),
          1,
        );
      },
    );
    await fireEvent.press(await screen.findByTestId('lead-row-l1'));
    await fireEvent.press(await screen.findByTestId('lead-delete'));

    await waitFor(() =>
      expect(repositories.quoteEstimator.deleteLead).toHaveBeenCalledWith('ana', 'l1'),
    );
    await waitFor(() => expect(screen).toHavePathname('/leads'));
    expect(screen.queryByTestId('lead-row-l1')).toBeNull();
    expect(screen.getByTestId('lead-row-l2')).toBeOnTheScreen();
  });

  it('sin conexión no borra: toast de BG-012 y háptica de aviso', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await openApp('/leads/l1', { leads: [lead('l1')] });
    await screen.findByTestId('lead-name');

    await act(async () => setNetworkOnline(false));
    expect(screen.getByTestId('lead-offline-notice')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('lead-delete'));

    expect(await screen.findByTestId('offline-mutation-toast')).toHaveTextContent(
      /Sin conexión. No se ha podido guardar el cambio./,
    );
    expect(alert).not.toHaveBeenCalled();
    expect(repositories.quoteEstimator.deleteLead).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );
  });

  it('una solicitud que no existe muestra el aviso de no disponible', async () => {
    await openApp('/leads/missing', { leads: [lead('l1')] });
    expect(await screen.findByTestId('lead-not-found')).toBeOnTheScreen();
  });
});

describe('enlace profundo /profile/solicitudes', () => {
  it('con un leadId válido abre el detalle con la lista debajo', async () => {
    await openApp('/profile/solicitudes?leadId=l1', { leads: [lead('l1')] });
    await waitFor(() => expect(screen).toHavePathname('/leads/l1'));
    expect(await screen.findByTestId('lead-name')).toHaveTextContent('Lucía Prueba');
    await act(async () => router.back());
    await waitFor(() => expect(screen).toHavePathname('/leads'));
    expect(await screen.findByTestId('lead-row-l1')).toBeOnTheScreen();
  });

  it.each([
    ['/profile/solicitudes?leadId=bad%20id', 'caracteres no permitidos'],
    ['/profile/solicitudes?leadId=l1&leadId=l2', 'dos leadId'],
    ['/profile/solicitudes?leadId=l1&next=%2Fadmin', 'parámetros extra'],
  ])('con %s (%s) abre la lista con el aviso de no disponible', async (url) => {
    await openApp(url, { leads: [lead('l1')] });
    expect(await screen.findByTestId('leads-unavailable-notice')).toHaveTextContent(
      'La solicitud solicitada no está disponible en esta cuenta.',
    );
    expect(screen).toHavePathname('/leads');
    expect(repositories.quoteEstimator.fetchLead).not.toHaveBeenCalled();
  });

  it('sin leadId abre la lista sin aviso', async () => {
    await openApp('/profile/solicitudes', { leads: [lead('l1')] });
    expect(await screen.findByTestId('lead-row-l1')).toBeOnTheScreen();
    expect(screen.queryByTestId('leads-unavailable-notice')).toBeNull();
  });
});

describe('modelo', () => {
  it('valida el leadId del enlace y de la notificación con notifications/navigation', () => {
    expect(leadIdFromDeepLink({ leadId: 'abc_D-9' })).toBe('abc_D-9');
    expect(leadIdFromDeepLink({ leadId: '../x' })).toBeNull();
    expect(leadIdFromDeepLink({ leadId: ['a', 'b'] })).toBeNull();
    expect(leadIdFromDeepLink({ leadId: 'a', other: 'b' })).toBeNull();
    expect(leadIdFromDeepLink({ leadId: 'a'.repeat(129) })).toBeNull();
    expect(leadRouteFromPushData({ leadId: 'l1' })).toBe('/leads/l1');
    expect(leadRouteFromPushData({ leadId: 'javascript:alert(1)' })).toBeNull();
    expect(leadRouteFromPushData(null)).toBeNull();
  });

  it('busca por nombre, email, teléfono y reforma, sin distinguir mayúsculas', () => {
    const leads = [
      lead('l1'),
      lead('l2', {
        contact: { name: 'Mario Ejemplo', email: 'mario@example.com', phone: '611 222 333' },
        selections: [{ room: 'kitchen', scope: 'partial', quality: 'medium', areaM2: 9 }],
      }),
    ];
    const ids = (search: string) => filterLeads(leads, search, '').map((item) => item.id);
    expect(ids('MARIO')).toEqual(['l2']);
    expect(ids('lucia@')).toEqual(['l1']);
    expect(ids('611 222')).toEqual(['l2']);
    expect(ids('baño')).toEqual(['l1']);
    expect(ids('nadie')).toEqual([]);
  });

  it('forma el enlace de WhatsApp con prefijo internacional', () => {
    expect(whatsappUrl('600 111 222')).toBe('https://wa.me/34600111222');
    expect(whatsappUrl('+351 912 345 678')).toBe('https://wa.me/351912345678');
    expect(whatsappUrl('0044 20 7946 0958')).toBe('https://wa.me/442079460958');
    expect(whatsappUrl('12 34')).toBeNull();
  });
});

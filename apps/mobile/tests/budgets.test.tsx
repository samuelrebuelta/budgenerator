import { Alert, Share, type AlertButton } from 'react-native';
import * as Sharing from 'expo-sharing';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { setNetworkOnline } from '@bg/app-core/network';
import { toastStore } from '@bg/app-core/toast';
import { budgetTotals, formatEuros } from '@bg/domain';
import { budgetView, type BudgetRecord } from '@bg/domain/budget/record';
import type { UserData } from '@bg/domain/types';
import { coordinator, repositories, useAuthStore, useBudgetStore } from '../src/state/stores';
import { setMockUser } from './helpers';
// Same fixtures as the domain and web tests: «Estudio de prueba», Pintura 2,5 m² × 10,75 €.
import { budgetRecord, sampleDocument, user } from '../../../packages/domain/tests/fixtures';

const mocked = <T,>(fn: T) => fn as unknown as jest.Mock;

const total = (record: BudgetRecord) => formatEuros(budgetTotals(budgetView(record)).total);

function answerAlerts(label: string) {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons?: AlertButton[]) =>
      buttons?.find((button) => button.text === label)?.onPress?.(),
    );
}

async function openApp(
  url: string,
  {
    records = [budgetRecord('b1')],
    account = {},
    emailVerified = false,
  }: { records?: BudgetRecord[]; account?: Partial<UserData>; emailVerified?: boolean } = {},
) {
  mocked(repositories.user.fetchUserData).mockResolvedValue({ ...user('ana'), ...account });
  mocked(repositories.budget.fetchBudgets).mockResolvedValue(records);
  setMockUser({ uid: 'ana', emailVerified } as never);
  await renderRouter('./app', { initialUrl: url });
}

function firstItem(record: BudgetRecord) {
  const chapter = budgetView(record).workItems[0]!;
  return { chapterId: chapter.id, itemId: chapter.tasks[0]!.id };
}

beforeEach(() => {
  coordinator.resetSession(null);
  useAuthStore.setState({ user: null, loading: true, error: null, emailVerified: false });
  jest.clearAllMocks();
  jest.restoreAllMocks();
  setNetworkOnline(true);
  toastStore.setState({ toast: null, offlineNoticeShown: false });
});

describe('lista de presupuestos', () => {
  it('muestra cada presupuesto con su total de @bg/domain, su estado y el valor presupuestado', async () => {
    const open = budgetRecord('b1');
    const accepted = budgetRecord('b2', {
      createdAt: '2026-11-01T10:00:00Z',
      acceptedAt: '2026-11-02T10:00:00Z',
      document: sampleDocument('budget', { clientName: 'Clínica Sur', budgetNumber: '2' }),
    });
    await openApp('/budgets', { records: [open, accepted] });

    const first = await screen.findByTestId('budget-row-b1');
    expect(within(first).getByText('Estudio de prueba')).toBeOnTheScreen();
    expect(within(first).getByText(total(open))).toBeOnTheScreen();
    const second = screen.getByTestId('budget-row-b2');
    expect(within(second).getByText('Presupuesto aceptado')).toBeOnTheScreen();
    const sum = budgetTotals(budgetView(open)).total + budgetTotals(budgetView(accepted)).total;
    expect(screen.getByTestId('budgets-total-value')).toHaveTextContent(formatEuros(sum));
  });

  it('borra con la acción de deslizar (y su acción accesible) tras confirmar', async () => {
    await openApp('/budgets');
    const alert = answerAlerts('Eliminar');
    await fireEvent(await screen.findByTestId('budget-row-b1'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

    expect(alert).toHaveBeenCalledWith(
      '¿Borrar presupuesto?',
      expect.any(String),
      expect.any(Array),
    );
    await waitFor(() =>
      expect(repositories.budget.deleteBudgetDoc).toHaveBeenCalledWith('ana', 'b1'),
    );
    expect(await screen.findByTestId('budgets-empty')).toBeOnTheScreen();
  });

  it('muestra el estado vacío y el aviso sin conexión', async () => {
    await openApp('/budgets', { records: [] });
    expect(await screen.findByText('No hay presupuestos')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Crear mi primer presupuesto' })).toBeOnTheScreen();

    await act(async () => setNetworkOnline(false));
    expect(screen.getByTestId('budgets-offline-notice')).toBeOnTheScreen();
  });
});

describe('editor', () => {
  it('al cambiar la cantidad recalcula importe y total con budgetTotals y lo guarda con la WriteQueue', async () => {
    const record = budgetRecord('b1');
    const { itemId } = firstItem(record);
    await openApp('/budgets/b1', { records: [record] });

    expect(await screen.findByTestId('budget-total')).toHaveTextContent(total(record));
    await fireEvent.press(screen.getByTestId(`item-${itemId}`));
    await fireEvent.changeText(await screen.findByTestId('item-quantity'), '4');

    expect(screen.getByTestId('item-amount')).toHaveTextContent(formatEuros(43));
    const updated = useBudgetStore.getState().records.find((item) => item.id === 'b1')!;
    expect(budgetView(updated).workItems[0]!.tasks[0]!.quantity).toBe(4);
    await fireEvent.press(screen.getByTestId('item-done'));
    expect(await screen.findByTestId('budget-total')).toHaveTextContent(total(updated));
    expect(total(updated)).not.toBe(total(record));

    await waitFor(() => expect(repositories.budget.saveBudget).toHaveBeenCalled(), {
      timeout: 3000,
    });
    expect(mocked(repositories.budget.saveBudget).mock.calls.at(-1)?.slice(0, 1)).toEqual(['ana']);
    expect(await screen.findByTestId('budget-save-status')).toHaveProp(
      'accessibilityLabel',
      'Guardado',
    );
  });

  it('sin conexión bloquea la edición de un presupuesto guardado con el aviso de BG-012', async () => {
    const record = budgetRecord('b1');
    const { itemId } = firstItem(record);
    await openApp('/budgets/b1', { records: [record] });
    await fireEvent.press(await screen.findByTestId(`item-${itemId}`));
    const quantity = await screen.findByTestId('item-quantity');

    await act(async () => setNetworkOnline(false));
    await fireEvent.changeText(quantity, '9');

    expect(await screen.findByTestId('offline-mutation-toast')).toHaveTextContent(
      /Sin conexión. No se ha podido guardar el cambio./,
    );
    const stored = useBudgetStore.getState().records.find((item) => item.id === 'b1')!;
    expect(stored).toBe(record);
    // renderRouter runs on fake timers: past the WriteQueue debounce (700 ms) nothing was written.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(repositories.budget.saveBudget).not.toHaveBeenCalled();
  });

  it('crea un presupuesto nuevo con cuota y lo abre guardado', async () => {
    await openApp('/budgets', { records: [] });
    mocked(repositories.budget.createBudget).mockImplementation(
      async (uid: string, pending: BudgetRecord) => ({
        userData: { ...user(uid), totalBudgetsCreated: 1 },
        record: { ...pending, revision: 1, number: 1, createdAt: 'now', updatedAt: 'now' },
      }),
    );
    await fireEvent.press(await screen.findByTestId('budget-create-button'));
    await fireEvent.changeText(await screen.findByTestId('budget-client-name'), 'Nuevo cliente');
    await fireEvent.press(screen.getByTestId('budget-add-chapter'));
    await fireEvent.press(await screen.findByRole('tab', { name: 'Personalizada' }));
    await fireEvent.changeText(screen.getByTestId('chapter-custom-name'), 'Fontanería');
    await fireEvent.press(screen.getByTestId('chapter-add'));
    expect(await screen.findByText('FONTANERÍA')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('budget-save'));
    await waitFor(() => expect(repositories.budget.createBudget).toHaveBeenCalled());
    const [uid, pending] = mocked(repositories.budget.createBudget).mock.calls[0]!;
    expect(uid).toBe('ana');
    expect(budgetView(pending).info.clientName).toBe('Nuevo cliente');
    await waitFor(() => expect(screen).toHavePathname(`/budgets/${pending.id}`));
    expect(await screen.findByTestId('budget-export-pdf')).toBeOnTheScreen();
  });
});

describe('plan Free (D7)', () => {
  it('al llegar al límite muestra BudgetLimitReached sin precios ni llamada a comprar', async () => {
    await openApp('/budgets', { records: [], account: { totalBudgetsCreated: 3 } });
    await fireEvent.press(await screen.findByTestId('budget-create-button'));

    expect(await screen.findByTestId('budget-limit-reached')).toBeOnTheScreen();
    expect(screen.getByText('Has alcanzado el límite de tu plan.')).toBeOnTheScreen();
    expect(screen.getByText('3 de 3 presupuestos utilizados')).toBeOnTheScreen();
    expect(screen.queryByText(/€|premium|comprar|precio|suscri|@gmail/i)).toBeNull();
    expect(screen.queryByTestId('budget-save')).toBeNull();
  });
});

describe('PDF, enlace público y aceptación', () => {
  it('genera el PDF con @bg/domain y lo comparte con la hoja nativa', async () => {
    await openApp('/budgets/b1');
    await fireEvent.press(await screen.findByTestId('budget-export-pdf'));

    await waitFor(() =>
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        'file:///cache/presupuesto-1.pdf',
        expect.objectContaining({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }),
      ),
    );
  });

  it('exige email verificado para el enlace público', async () => {
    await openApp('/budgets/b1');
    await fireEvent.press(await screen.findByTestId('budget-share-link'));

    expect(
      await screen.findByText(/Hasta entonces no podrás crear enlaces públicos./),
    ).toBeOnTheScreen();
    expect(repositories.budget.shareBudget).not.toHaveBeenCalled();
  });

  it('con email verificado crea el enlace y lo comparte con la hoja nativa', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await openApp('/budgets/b1', { emailVerified: true });
    await fireEvent.press(await screen.findByTestId('budget-share-link'));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://budgenerator.web.app/shared/shared-token' }),
        expect.any(Object),
      ),
    );
    expect(mocked(repositories.budget.shareBudget).mock.calls[0]![0]).toMatchObject({ id: 'b1' });
    expect(
      await screen.findByText('Enlace de esta versión · válido durante 30 días.'),
    ).toBeOnTheScreen();
  });

  it('marca como aceptado tras confirmar y deja retirar la aceptación', async () => {
    mocked(repositories.budgetAcceptance.acceptBudget).mockResolvedValue(2);
    await openApp('/budgets/b1');
    answerAlerts('Marcar como aceptado');
    await fireEvent.press(await screen.findByTestId('budget-accept'));

    await waitFor(() =>
      expect(repositories.budgetAcceptance.acceptBudget).toHaveBeenCalledWith(
        'ana',
        'b1',
        expect.any(String),
        1,
      ),
    );
    expect(await screen.findByTestId('budget-withdraw')).toBeOnTheScreen();
    expect(screen.queryByTestId('budget-delete')).toBeNull();
  });
});

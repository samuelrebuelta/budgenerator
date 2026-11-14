import { Alert, type AlertButton } from 'react-native';
import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { setNetworkOnline } from '@bg/app-core/network';
import { toastStore } from '@bg/app-core/toast';
import { formatEuros } from '@bg/domain';
import type { BudgetRecord } from '@bg/domain/budget/record';
import { router } from 'expo-router';
import { buildProjectAssignment } from '@bg/domain/project/assignments';
import { calculateProjectProgressHistory } from '@bg/domain/project/history';
import { calculateProjectProgress, workItemProgress } from '@bg/domain/project/progress';
import { buildProjectSupplement } from '@bg/domain/project/supplements';
import type {
  Project,
  ProjectDetail,
  ProjectProgressMutation,
  ProjectTask,
  ProjectWorkItem,
} from '@bg/domain/project/types';
import type { WorkCrew, WorkforceMember } from '@bg/domain/workforce/types';
import { coordinator, repositories, useAuthStore, useProjectStore } from '../src/state/stores';
import { setMockUser } from './helpers';
import { budgetRecord, user } from '../../../packages/domain/tests/fixtures';

const mocked = <T,>(fn: T) => fn as unknown as jest.Mock;

function task(id: string, description: string, quantity: number, price: number): ProjectTask {
  return {
    id,
    description,
    quantity,
    price,
    unit: 'm2',
    conceptId: '',
    code: '',
    cost: 0,
    measured: false,
    composed: false,
    shared: false,
  };
}

/** Project as the shared repository returns it: progress fields from `@bg/domain`. */
function projectDetail(
  workItems: ProjectWorkItem[],
  patch: Partial<ProjectDetail> = {},
): ProjectDetail {
  return {
    id: 'p1',
    sourceBudgetId: 'b1',
    sourceBudgetNumber: '1',
    title: 'Calle Mayor 1',
    clientName: 'Estudio de prueba',
    address: 'Calle Mayor 1',
    budgetDate: '2026-11-01',
    acceptedAt: '2026-11-02T10:00:00.000Z',
    createdAt: '2026-11-03T10:00:00.000Z',
    subtotal: 400,
    iva: 40,
    total: 440,
    ivaRate: 0.1,
    workItemCount: workItems.length,
    ...calculateProjectProgress(workItems),
    supplementsSubtotal: 0,
    supplementsIva: 0,
    updatedTotal: 440,
    workItems,
    assignments: [],
    supplements: [],
    supplementVoids: [],
    ...patch,
  };
}

const chapter = (tasks: ProjectTask[]): ProjectWorkItem => ({
  id: 'w1',
  name: 'Pintura',
  position: 0,
  tasks,
});

function summary(detail: ProjectDetail): Project {
  const { workItems, assignments, supplements, supplementVoids, ...rest } = detail;
  void workItems;
  void assignments;
  void supplements;
  void supplementVoids;
  return rest;
}

/** In-memory `toggleTask` transaction: flips the item and recomputes progress with `@bg/domain`. */
function toggleLike(detail: ProjectDetail) {
  let current = detail;
  return async (
    _uid: string,
    _projectId: string,
    workItemId: string,
    taskId: string,
  ): Promise<ProjectProgressMutation> => {
    const workItems = current.workItems.map((item) =>
      item.id !== workItemId
        ? item
        : {
            ...item,
            tasks: item.tasks.map((entry) => {
              if (entry.id !== taskId) return entry;
              if (entry.completedAt) {
                const reopened = { ...entry };
                delete reopened.completedAt;
                return reopened;
              }
              return { ...entry, completedAt: '2026-11-14T09:00:00.000Z' };
            }),
          },
    );
    current = { ...current, ...calculateProjectProgress(workItems), workItems };
    return { project: summary(current), workItem: workItems.find((i) => i.id === workItemId)! };
  };
}

function answerAlerts(label: string) {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons?: AlertButton[]) =>
      buttons?.find((button) => button.text === label)?.onPress?.(),
    );
}

async function openApp(
  url: string,
  { projects = [] as ProjectDetail[], records = [budgetRecord('b1')] as BudgetRecord[] } = {},
) {
  mocked(repositories.user.fetchUserData).mockResolvedValue(user('ana'));
  mocked(repositories.budget.fetchBudgets).mockResolvedValue(records);
  mocked(repositories.project.fetchProjects).mockResolvedValue(projects.map(summary));
  mocked(repositories.project.fetchProject).mockImplementation(
    async (_uid: string, id: string) => projects.find((project) => project.id === id) ?? null,
  );
  setMockUser({ uid: 'ana' });
  await renderRouter('./app', { initialUrl: url });
}

beforeEach(() => {
  coordinator.resetSession(null);
  useAuthStore.setState({ user: null, loading: true, error: null, emailVerified: false });
  jest.clearAllMocks();
  jest.restoreAllMocks();
  setNetworkOnline(true);
  toastStore.setState({ toast: null, offlineNoticeShown: false });
});

const twoTasks = () =>
  projectDetail([chapter([task('t1', 'Paredes', 10, 10), task('t2', 'Techos', 10, 30)])]);

describe('lista de proyectos', () => {
  it('muestra cada proyecto con avance, estado y total actualizado, y filtra por estado', async () => {
    const open = twoTasks();
    const done = projectDetail(
      [chapter([{ ...task('t9', 'Suelo', 1, 100), completedAt: '2026-11-10' }])],
      { id: 'p2', clientName: 'Clínica Sur', title: 'Avenida 2', updatedTotal: 1234.5 },
    );
    await openApp('/projects', { projects: [open, done] });

    const first = await screen.findByTestId('project-row-p1');
    expect(within(first).getByText('Estudio de prueba')).toBeOnTheScreen();
    expect(within(first).getByText('0%')).toBeOnTheScreen();
    expect(within(first).getByLabelText('Estado: Pendiente')).toBeOnTheScreen();
    const second = screen.getByTestId('project-row-p2');
    expect(within(second).getByText('100%')).toBeOnTheScreen();
    expect(second.props.accessibilityLabel).toContain(formatEuros(1234.5));

    await fireEvent.press(screen.getByTestId('projects-filter-completed'));
    expect(screen.queryByTestId('project-row-p1')).toBeNull();
    expect(screen.getByTestId('project-row-p2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('projects-filter-in_progress'));
    expect(await screen.findByTestId('projects-no-results')).toBeOnTheScreen();
  });

  it('muestra el estado vacío con acceso a presupuestos y el aviso sin conexión', async () => {
    await openApp('/projects');
    expect(await screen.findByText('Aquí aparecerán tus proyectos')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver presupuestos' })).toBeOnTheScreen();

    await act(async () => setNetworkOnline(false));
    expect(screen.getByTestId('projects-offline-notice')).toBeOnTheScreen();
  });
});

describe('detalle del proyecto', () => {
  it('marcar una partida actualiza el progreso con workItemProgress y vibra', async () => {
    const detail = twoTasks();
    mocked(repositories.project.toggleTask).mockImplementation(toggleLike(detail));
    await openApp('/projects/p1', { projects: [detail] });

    expect(await screen.findByTestId('project-percent')).toHaveTextContent('0%');
    await fireEvent.press(screen.getByTestId('project-task-t1'));

    await waitFor(() =>
      expect(repositories.project.toggleTask).toHaveBeenCalledWith('ana', 'p1', 'w1', 't1'),
    );
    const updated = useProjectStore.getState().activeProject!;
    const expected = workItemProgress(updated.workItems[0]!, updated.mode);
    expect(expected.percent).toBe(25);
    expect(await screen.findByTestId('project-percent')).toHaveTextContent(`${updated.percent}%`);
    expect(screen.getByTestId('work-item-progress-w1')).toHaveTextContent(
      `1 de 2 partidas · ${expected.percent}%`,
    );
    expect(screen.getByTestId('project-task-t1')).toBeChecked();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );

    await fireEvent.press(screen.getByTestId('project-task-t1'));
    await waitFor(() => expect(screen.getByTestId('project-task-t1')).not.toBeChecked());
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(screen.getByTestId('project-percent')).toHaveTextContent('0%');
  });

  it('sin conexión bloquea marcar, completar y añadir ampliaciones con el aviso de BG-012', async () => {
    const detail = twoTasks();
    await openApp('/projects/p1', { projects: [detail] });
    await screen.findByTestId('project-task-t1');

    await act(async () => setNetworkOnline(false));
    expect(screen.getByTestId('project-offline-notice')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-task-t1'));

    expect(await screen.findByTestId('offline-mutation-toast')).toHaveTextContent(
      /Sin conexión. No se ha podido guardar el cambio./,
    );
    await fireEvent.press(screen.getByTestId('work-item-complete-w1'));
    expect(repositories.project.toggleTask).not.toHaveBeenCalled();
    expect(repositories.project.completeWorkItem).not.toHaveBeenCalled();
    expect(useProjectStore.getState().activeProject?.completedConcepts).toBe(0);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );
  });

  it('guarda la fecha estimada de fin elegida en el selector nativo', async () => {
    await openApp('/projects/p1', { projects: [twoTasks()] });
    await fireEvent.press(await screen.findByTestId('project-estimated-end'));
    const picker = await screen.findByTestId('project-estimated-end-picker');

    await fireEvent(picker, 'valueChange', { nativeEvent: {} }, new Date(2026, 11, 20, 12));

    await waitFor(() =>
      expect(repositories.project.setEstimatedEndDate).toHaveBeenCalledWith(
        'ana',
        'p1',
        '2026-12-20',
      ),
    );
    expect(useProjectStore.getState().activeProject?.estimatedEndDate).toBe('2026-12-20');
  });

  it('añade una ampliación con los importes de buildProjectSupplement', async () => {
    const detail = twoTasks();
    mocked(repositories.project.addSupplement).mockImplementation(
      async (_uid: string, _projectId: string, id: string, input) => {
        const supplement = buildProjectSupplement(detail, id, input, '2026-11-14T10:00:00.000Z');
        const project = summary({
          ...detail,
          supplementsSubtotal: supplement.subtotal,
          supplementsIva: supplement.iva,
          updatedTotal: detail.total + supplement.total,
        });
        return {
          project,
          supplement,
          workItem: { id: supplement.workItemId, name: supplement.description, tasks: [] },
        };
      },
    );
    await openApp('/projects/p1', { projects: [detail] });
    await fireEvent.press(await screen.findByTestId('project-supplement-add'));
    await fireEvent.changeText(await screen.findByTestId('supplement-description'), 'Rozas');
    await fireEvent.changeText(screen.getByTestId('supplement-quantity'), '2');
    await fireEvent.changeText(screen.getByTestId('supplement-price'), '12,5');

    const expected = buildProjectSupplement(
      detail,
      'preview',
      { description: 'Rozas', quantity: 2, unit: 'ud', unitPrice: 12.5 },
      '2026-11-14T10:00:00.000Z',
    );
    expect(screen.getByTestId('supplement-total')).toHaveTextContent(formatEuros(expected.total));
    await fireEvent.press(screen.getByTestId('supplement-save'));

    await waitFor(() => expect(repositories.project.addSupplement).toHaveBeenCalled());
    expect(mocked(repositories.project.addSupplement).mock.calls[0]!.slice(0, 2)).toEqual([
      'ana',
      'p1',
    ]);
    expect(
      await within(screen.getByTestId('project-supplements')).findByText('Rozas'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('project-updated-total')).toHaveTextContent(
      formatEuros(detail.total + expected.total),
    );
  });

  it('muestra el historial de avance por fecha de calculateProjectProgressHistory', async () => {
    const detail = projectDetail([
      chapter([
        { ...task('t1', 'Paredes', 10, 10), completedAt: '2026-11-05T09:00:00.000Z' },
        { ...task('t2', 'Techos', 10, 30), completedAt: '2026-11-09T09:00:00.000Z' },
        task('t3', 'Zócalos', 10, 10),
      ]),
    ]);
    const points = calculateProjectProgressHistory(detail.workItems, detail.mode);
    await openApp('/projects/p1', { projects: [detail] });
    await fireEvent.press(await screen.findByTestId('project-history-button'));

    expect(await screen.findByTestId('project-history')).toBeOnTheScreen();
    expect(points).toHaveLength(2);
    for (const point of points) {
      const row = screen.getByTestId(`project-history-${point.date}`);
      expect(within(row).getByText(`${point.percent}%`)).toBeOnTheScreen();
      expect(within(row).getByText(`${point.completedConcepts} de 3`)).toBeOnTheScreen();
    }
  });
});

describe('convertir en proyecto', () => {
  it('convierte un presupuesto aceptado tras confirmar y abre el proyecto', async () => {
    const accepted = budgetRecord('b1', { acceptedAt: '2026-11-02T10:00:00.000Z' });
    const detail = twoTasks();
    mocked(repositories.project.convertBudgetToProject).mockResolvedValue({
      projectId: 'p1',
      budgetRevision: 2,
    });
    await openApp('/budgets/b1', { records: [accepted] });
    mocked(repositories.project.fetchProject).mockResolvedValue(detail);
    const alert = answerAlerts('Convertir en proyecto');
    await fireEvent.press(await screen.findByTestId('budget-convert'));

    expect(alert).toHaveBeenCalledWith(
      '¿Convertir en proyecto?',
      expect.any(String),
      expect.any(Array),
    );
    await waitFor(() =>
      expect(repositories.project.convertBudgetToProject).toHaveBeenCalledWith('ana', 'b1'),
    );
    await waitFor(() => expect(screen).toHavePathname('/projects/p1'));
    expect(await screen.findByTestId('project-summary')).toBeOnTheScreen();
    expect(useProjectStore.getState().projects.map((project) => project.id)).toEqual(['p1']);
  });

  it('sin conexión no convierte y muestra el aviso de BG-012', async () => {
    const accepted = budgetRecord('b1', { acceptedAt: '2026-11-02T10:00:00.000Z' });
    await openApp('/budgets/b1', { records: [accepted] });
    answerAlerts('Convertir en proyecto');
    const button = await screen.findByTestId('budget-convert');
    await act(async () => setNetworkOnline(false));
    await fireEvent.press(button);

    expect(await screen.findByTestId('offline-mutation-toast')).toBeOnTheScreen();
    expect(repositories.project.convertBudgetToProject).not.toHaveBeenCalled();
  });
});

describe('editar nombre y cliente', () => {
  it('guarda nombre y cliente recortados con updateProjectMetadata y actualiza el detalle', async () => {
    mocked(repositories.project.updateProjectMetadata).mockImplementation(
      async (_uid: string, _id: string, title: string, clientName: string) => ({
        title,
        address: title,
        clientName,
        budgetRevision: 2,
      }),
    );
    await openApp('/projects/p1', { projects: [twoTasks()] });
    await fireEvent.press(await screen.findByTestId('project-edit'));

    const title = await screen.findByTestId('project-edit-title');
    expect(title.props.value).toBe('Calle Mayor 1');
    await fireEvent.changeText(title, '  Reforma Calle Mayor  ');
    await fireEvent.changeText(screen.getByTestId('project-edit-client'), ' Clínica Sur ');
    await fireEvent.press(screen.getByTestId('project-edit-save'));

    await waitFor(() =>
      expect(repositories.project.updateProjectMetadata).toHaveBeenCalledWith(
        'ana',
        'p1',
        'Reforma Calle Mayor',
        'Clínica Sur',
      ),
    );
    await waitFor(() => expect(screen.queryByTestId('project-edit-sheet')).toBeNull());
    expect(await screen.findByText('Reforma Calle Mayor')).toBeOnTheScreen();
    expect(useProjectStore.getState().activeProject).toMatchObject({
      title: 'Reforma Calle Mayor',
      address: 'Reforma Calle Mayor',
      clientName: 'Clínica Sur',
    });
  });

  it('valida como la web: nombre obligatorio y cliente de 120 caracteres como máximo', async () => {
    await openApp('/projects/p1', { projects: [twoTasks()] });
    await fireEvent.press(await screen.findByTestId('project-edit'));

    await fireEvent.changeText(await screen.findByTestId('project-edit-title'), '   ');
    await fireEvent.press(screen.getByTestId('project-edit-save'));
    expect(await screen.findByTestId('project-edit-error')).toHaveTextContent(
      'El nombre del proyecto debe tener entre 1 y 120 caracteres.',
    );

    await fireEvent.changeText(screen.getByTestId('project-edit-title'), 'Obra');
    await fireEvent.changeText(screen.getByTestId('project-edit-client'), 'x'.repeat(121));
    await fireEvent.press(screen.getByTestId('project-edit-save'));
    expect(await screen.findByTestId('project-edit-error')).toHaveTextContent(
      'El nombre del cliente no puede superar los 120 caracteres.',
    );
    expect(repositories.project.updateProjectMetadata).not.toHaveBeenCalled();
  });

  it('sin conexión no abre la hoja ni guarda, con el aviso de BG-012', async () => {
    await openApp('/projects/p1', { projects: [twoTasks()] });
    await fireEvent.press(await screen.findByTestId('project-edit'));
    await fireEvent.changeText(await screen.findByTestId('project-edit-title'), 'Obra nueva');

    await act(async () => setNetworkOnline(false));
    await fireEvent.press(screen.getByTestId('project-edit-save'));
    expect(await screen.findByTestId('offline-mutation-toast')).toBeOnTheScreen();
    expect(repositories.project.updateProjectMetadata).not.toHaveBeenCalled();
    expect(useProjectStore.getState().activeProject?.title).toBe('Calle Mayor 1');

    await act(async () => router.back());
    await waitFor(() => expect(screen.queryByTestId('project-edit-sheet')).toBeNull());
    await fireEvent.press(screen.getByTestId('project-edit'));
    expect(screen.queryByTestId('project-edit-sheet')).toBeNull();
  });
});

describe('equipo asignado', () => {
  const at = '2026-11-01T00:00:00.000Z';
  const member = (id: string, name: string): WorkforceMember => ({
    id,
    name,
    status: 'active',
    createdAt: at,
    updatedAt: at,
  });
  const crew = (id: string, label: string, memberIds: string[]): WorkCrew => ({
    id,
    label,
    color: 'green',
    memberIds,
    status: 'active',
    createdAt: at,
    updatedAt: at,
  });
  const ana = member('m1', 'Ana Pérez');
  const luis = member('m2', 'Luis Gil');
  const eva = member('m3', 'Eva Ruiz');
  const asignada = buildProjectAssignment({ resourceType: 'member', resource: ana }, at);

  function withWorkforce(members: WorkforceMember[], crews: WorkCrew[]) {
    mocked(repositories.workforce.fetchMembers).mockResolvedValue(members);
    mocked(repositories.workforce.fetchCrews).mockResolvedValue(crews);
  }

  it('marca el conflicto de cuadrilla, asigna una persona libre y la quita', async () => {
    withWorkforce([ana, luis, eva], [crew('c1', 'Pintores', ['m1', 'm2'])]);
    mocked(repositories.project.addAssignment).mockImplementation(
      async (_uid: string, _projectId: string, _type: 'member', id: string) =>
        buildProjectAssignment({ resourceType: 'member', resource: id === 'm2' ? luis : eva }, at),
    );
    const detail = projectDetail(twoTasks().workItems, { assignments: [asignada] });
    await openApp('/projects/p1', { projects: [detail] });

    expect(await screen.findByTestId('assignment-member_m1')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId('project-team-assign'));

    expect(await screen.findByTestId('assign-crew-c1-conflict')).toHaveTextContent(
      'Incluye a Ana Pérez, ya asignada individualmente',
    );
    expect(screen.getByTestId('assign-crew-c1-button')).toBeDisabled();
    expect(screen.getByTestId('assign-member-m1-button')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('assign-member-m2-button'));

    await waitFor(() =>
      expect(repositories.project.addAssignment).toHaveBeenCalledWith('ana', 'p1', 'member', 'm2'),
    );
    expect(await screen.findByTestId('assignment-member_m2')).toBeOnTheScreen();
    expect(screen.queryByTestId('assign-sheet')).toBeNull();

    await fireEvent.press(screen.getByTestId('assignment-remove-member_m1'));
    await waitFor(() =>
      expect(repositories.project.removeAssignment).toHaveBeenCalledWith('ana', 'p1', 'member_m1'),
    );
    await waitFor(() => expect(screen.queryByTestId('assignment-member_m1')).toBeNull());
  });

  it('muestra el conflicto que devuelve la transacción con assignmentState.revision', async () => {
    withWorkforce([ana, luis], [crew('c2', 'Albañiles', ['m2'])]);
    mocked(repositories.project.addAssignment).mockRejectedValue(
      new Error('La cuadrilla comparte integrantes con otra cuadrilla asignada al proyecto.'),
    );
    await openApp('/projects/p1', { projects: [twoTasks()] });
    await fireEvent.press(await screen.findByTestId('project-team-assign'));
    await fireEvent.press(await screen.findByTestId('assign-crew-c2-button'));

    expect(await screen.findByTestId('assign-error')).toHaveTextContent(
      'La cuadrilla comparte integrantes con otra cuadrilla asignada al proyecto.',
    );
    expect(screen.getByTestId('assign-sheet')).toBeOnTheScreen();
    expect(useProjectStore.getState().activeProject?.assignments).toEqual([]);
  });

  it('sin conexión no asigna ni quita, con el aviso de BG-012', async () => {
    withWorkforce([ana, luis], []);
    const detail = projectDetail(twoTasks().workItems, { assignments: [asignada] });
    await openApp('/projects/p1', { projects: [detail] });
    await screen.findByTestId('assignment-member_m1');
    await fireEvent.press(await screen.findByTestId('project-team-assign'));
    await screen.findByTestId('assign-member-m2-button');

    await act(async () => setNetworkOnline(false));
    await fireEvent.press(screen.getByTestId('assign-member-m2-button'));
    expect(await screen.findByTestId('offline-mutation-toast')).toBeOnTheScreen();
    expect(repositories.project.addAssignment).not.toHaveBeenCalled();

    await act(async () => router.back());
    await waitFor(() => expect(screen.queryByTestId('assign-sheet')).toBeNull());
    await fireEvent.press(screen.getByTestId('project-team-assign'));
    expect(screen.queryByTestId('assign-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('assignment-remove-member_m1'));
    expect(repositories.project.removeAssignment).not.toHaveBeenCalled();
    expect(screen.getByTestId('assignment-member_m1')).toBeOnTheScreen();
  });
});

import { describe, expect, it } from 'vitest';
import { budget } from './fixtures';
import { prepareProjectSnapshot } from '../src/entities/project/model/conversion';

const accepted = (overrides: Partial<ReturnType<typeof budget>> = {}) => ({
  ...budget(),
  acceptedAt: '2026-10-18T09:00:00.000Z',
  ...overrides,
});

describe('prepareProjectSnapshot', () => {
  it('copies accepted budget data and calculates the project totals from the source', () => {
    const source = accepted({
      adjustment: { multiplier: 1.2, reason: 'Ajuste de obra' },
      ivaRate: 0.21,
    });
    const snapshot = prepareProjectSnapshot(source, 'project-1', '2026-10-18T10:00:00.000Z');

    expect(snapshot.project).toMatchObject({
      id: 'project-1',
      sourceBudgetId: 'budget-a',
      sourceBudgetNumber: '1',
      title: 'Proyecto de demostración',
      clientName: 'Estudio de prueba',
      address: 'Proyecto de demostración',
      acceptedAt: '2026-10-18T09:00:00.000Z',
      createdAt: '2026-10-18T10:00:00.000Z',
      subtotal: 32.25,
      iva: 6.77,
      total: 39.02,
      ivaRate: 0.21,
      workItemCount: 1,
      mode: 'amount',
      totalConcepts: 1,
      completedConcepts: 0,
      totalAmount: 26.88,
      completedAmount: 0,
      percent: 0,
      status: 'pending',
    });
    expect(snapshot.workItems[0]).toMatchObject({
      id: 'work',
      name: 'Pintura',
      tasks: [
        {
          id: 'task',
          description: 'Pintura de paredes',
          quantity: 2.5,
          price: 10.75,
          cost: 4.5,
        },
      ],
    });

    source.workItems[0]!.tasks[0]!.price = 99;
    expect(snapshot.workItems[0]!.tasks[0]!.price).toBe(10.75);
  });

  it('refuses an unaccepted budget', () => {
    const source = budget();

    expect(() => prepareProjectSnapshot(source, 'project-1', '2026-10-18T10:00:00.000Z')).toThrow(
      /aceptad/i,
    );
  });

  it('refuses a budget that has no concepts which can be tracked', () => {
    const source = accepted({ workItems: [{ id: 'empty', name: 'Vacía', tasks: [] }] });

    expect(() => prepareProjectSnapshot(source, 'project-1', '2026-10-18T10:00:00.000Z')).toThrow();
  });

  it('refuses repeated or empty IDs that would overwrite a snapshot document or concept', () => {
    const part = budget().workItems[0]!;
    expect(() =>
      prepareProjectSnapshot(
        accepted({ workItems: [part, { ...part, name: 'Duplicada' }] }),
        'project-1',
        '2026-10-18T10:00:00.000Z',
      ),
    ).toThrow(/identificadores únicos/i);
    expect(() =>
      prepareProjectSnapshot(
        accepted({
          workItems: [{ ...part, tasks: [part.tasks[0]!, { ...part.tasks[0]!, id: '' }] }],
        }),
        'project-1',
        '2026-10-18T10:00:00.000Z',
      ),
    ).toThrow(/identificadores únicos/i);
  });

  it('allows the current 200-work-item budget limit', () => {
    const workItems = Array.from({ length: 200 }, (_, index) => ({
      id: `part-${index}`,
      name: `Partida ${index}`,
      tasks: [
        {
          id: `task-${index}`,
          description: `Concepto ${index}`,
          quantity: 1,
          unit: 'unit' as const,
          price: 1,
          cost: 0,
        },
      ],
    }));

    expect(
      prepareProjectSnapshot(accepted({ workItems }), 'project-1', '2026-10-18T10:00:00.000Z')
        .workItems,
    ).toHaveLength(200);
  });

  it('refuses a snapshot above 200 work items', () => {
    const workItems = Array.from({ length: 201 }, (_, index) => ({
      id: `part-${index}`,
      name: `Partida ${index}`,
      tasks: [],
    }));

    expect(() =>
      prepareProjectSnapshot(accepted({ workItems }), 'project-1', '2026-10-18T10:00:00.000Z'),
    ).toThrow(/200/);
  });

  it('refuses a work-item document at or above the safe Firestore size limit', () => {
    const source = accepted({
      workItems: [
        {
          id: 'large',
          name: 'Partida grande',
          tasks: [
            {
              id: 'large-task',
              description: 'x'.repeat(900_000),
              quantity: 1,
              unit: 'unit',
              price: 1,
              cost: 0,
            },
          ],
        },
      ],
    });

    expect(() => prepareProjectSnapshot(source, 'project-1', '2026-10-18T10:00:00.000Z')).toThrow(
      /tamaño/i,
    );
  });
});

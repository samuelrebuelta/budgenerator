import { describe, expect, it } from 'vitest';
import type { Project } from '../src/entities/project/model/types';
import {
  buildProjectSupplement,
  createSupplementWorkItem,
} from '../src/entities/project/model/supplements';

const project: Project = {
  id: 'project-1',
  sourceBudgetId: 'budget-1',
  sourceBudgetNumber: '8',
  title: 'Reforma de prueba',
  clientName: 'Cliente',
  address: 'Madrid',
  budgetDate: '2026-10-10',
  acceptedAt: '2026-10-11T10:00:00.000Z',
  createdAt: '2026-10-11T10:00:00.000Z',
  subtotal: 120,
  iva: 25.2,
  total: 145.2,
  ivaRate: 0.21,
  adjustment: { multiplier: 1.2, reason: 'Ajuste incluido en el presupuesto original' },
  workItemCount: 1,
  mode: 'amount',
  totalConcepts: 1,
  completedConcepts: 0,
  totalAmount: 120,
  completedAmount: 0,
  percent: 0,
  status: 'pending',
  supplementsSubtotal: 0,
  supplementsIva: 0,
  updatedTotal: 145.2,
};

describe('project supplements', () => {
  it('adds supplement VAT from the accepted project without applying its adjustment again', () => {
    const supplement = buildProjectSupplement(
      project,
      'extra-electricity',
      { description: 'Punto de luz adicional', quantity: 2, unit: 'unit', unitPrice: 20 },
      '2026-10-18T12:00:00.000Z',
    );

    expect(supplement).toMatchObject({
      id: 'extra-electricity',
      description: 'Punto de luz adicional',
      quantity: 2,
      unit: 'unit',
      unitPrice: 20,
      vatRate: 0.21,
      subtotal: 40,
      iva: 8.4,
      total: 48.4,
      createdAt: '2026-10-18T12:00:00.000Z',
      workItemId: 'supplement_extra-electricity',
    });
    expect(createSupplementWorkItem(supplement, 1)).toMatchObject({
      id: 'supplement_extra-electricity',
      supplementId: 'extra-electricity',
      tasks: [
        {
          id: 'concept_extra-electricity',
          description: 'Punto de luz adicional',
          quantity: 2,
          unit: 'unit',
          price: 20,
          cost: 0,
        },
      ],
    });
  });

  it('rejects non-positive quantities and prices', () => {
    expect(() =>
      buildProjectSupplement(
        project,
        'invalid',
        { description: 'Concepto', quantity: 0, unit: 'unit', unitPrice: 20 },
        '2026-10-18T12:00:00.000Z',
      ),
    ).toThrow(/cantidad/i);
    expect(() =>
      buildProjectSupplement(
        project,
        'invalid',
        { description: 'Concepto', quantity: 1, unit: 'unit', unitPrice: 0 },
        '2026-10-18T12:00:00.000Z',
      ),
    ).toThrow(/precio/i);
  });
});

import type { Budget, UserData, TariffCatalog } from '../src/shared/types';
export const budget = (id = 'budget-a'): Budget => ({
  id,
  info: {
    clientName: 'Estudio de prueba',
    address: 'Proyecto de demostración',
    date: '2026-10-14',
    budgetNumber: '1',
  },
  workItems: [
    {
      id: 'work',
      name: 'Pintura',
      tasks: [
        {
          id: 'task',
          description: 'Pintura de paredes',
          quantity: 2.5,
          unit: 'm2',
          price: 10.75,
          cost: 4.5,
        },
      ],
    },
  ],
  createdAt: '2026-10-14T10:00:00Z',
});
export const user = (uid = 'alice'): UserData => ({
  uid,
  email: `${uid}@example.test`,
  accountData: { isAdmin: false, plan: 'free' },
  totalBudgetsCreated: 0,
  budgetSlotsReleased: 0,
  createdAt: '2026-10-14T10:00:00Z',
});
export const catalog = (): TariffCatalog => ({
  id: 'catalog-a',
  name: 'Base de prueba',
  createdAt: '2026-10-14',
  updatedAt: '2026-10-14',
  parts: [
    {
      id: 'part-pintura',
      name: 'Pintura',
      concepts: [
        {
          id: 'tariff-a',
          description: 'Original',
          unit: 'm2',
          basePrice: 10.75,
          cost: 4.5,
        },
      ],
    },
  ],
});

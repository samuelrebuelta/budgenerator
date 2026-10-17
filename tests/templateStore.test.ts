import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplateDoc: vi.fn(),
}));
vi.mock('../src/entities/template/api/firestore', () => api);

import { resetTemplateStore, useTemplateStore } from '../src/entities/template/model/store';
import { setSessionUid } from '../src/shared/model/session';
import type { BudgetTemplate } from '../src/shared/types';

beforeEach(() => {
  vi.clearAllMocks();
  setSessionUid('alice');
  resetTemplateStore();
  api.fetchTemplates.mockResolvedValue([]);
  api.saveTemplate.mockResolvedValue(undefined);
});
afterEach(() => resetTemplateStore());

it('keeps a template snapshot editable after its catalog part has been removed', async () => {
  const snapshot: BudgetTemplate = {
    id: 'template-with-removed-source',
    name: 'Pintura histórica',
    createdAt: '2026-10-17',
    workItems: [
      {
        id: 'snapshot-part',
        name: 'Pintura histórica',
        catalogPartId: 'removed-part',
        tasks: [
          {
            id: 'snapshot-concept',
            catalogConceptId: 'removed-concept',
            description: 'Acabado guardado',
            quantity: 3,
            unit: 'm2',
            price: 18,
            cost: 8,
          },
        ],
      },
    ],
  };
  api.fetchTemplates.mockResolvedValue([snapshot]);
  await useTemplateStore.getState().loadTemplates('alice');
  const edited: BudgetTemplate = {
    ...useTemplateStore.getState().templates[0]!,
    workItems: useTemplateStore.getState().templates[0]!.workItems.map((item) => ({
      ...item,
      tasks: item.tasks.map((task) => ({ ...task, quantity: 4 })),
    })),
  };
  await useTemplateStore.getState().updateTemplate(edited);
  expect(api.saveTemplate).toHaveBeenCalledWith(
    'alice',
    expect.objectContaining({
      workItems: [
        expect.objectContaining({
          catalogPartId: 'removed-part',
          tasks: [expect.objectContaining({ catalogConceptId: 'removed-concept', quantity: 4 })],
        }),
      ],
    }),
  );
});

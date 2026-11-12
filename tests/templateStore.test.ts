import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchTemplates: vi.fn(),
  createTemplate: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplateDoc: vi.fn(),
}));
vi.mock('../src/entities/template/api/firestore', () => api);

import { resetTemplateStore, useTemplateStore } from '../src/entities/template/model/store';
import { templateView } from '../src/entities/template/model/record';
import { updateItem } from '../src/entities/construction-document/model';
import { setSessionUid } from '../src/shared/model/session';
import { sampleDocument } from './fixtures';

beforeEach(() => {
  vi.clearAllMocks();
  setSessionUid('alice');
  resetTemplateStore();
  api.fetchTemplates.mockResolvedValue([]);
  api.saveTemplate.mockImplementation(async (_uid, _record, expected: number) => expected + 1);
  api.createTemplate.mockImplementation(async (_uid, id, document) => ({
    id,
    revision: 1,
    createdAt: 'now',
    updatedAt: 'now',
    document,
  }));
});
afterEach(() => resetTemplateStore());

it('creates a template from a budget as a canonical template document', async () => {
  const id = await useTemplateStore
    .getState()
    .createTemplateFrom(sampleDocument('budget', { ivaRate: 0.21 }), 'Baño completo');
  const document = api.createTemplate.mock.calls[0]![2];
  expect(document.kind).toBe('template');
  expect(document.business).toMatchObject({ name: 'Baño completo', clientName: '', ivaRate: 0.21 });
  expect(document.concepts[document.rootConceptId].code).toBe('PLANTILLA##');
  expect(templateView(useTemplateStore.getState().templates[0]!)).toMatchObject({
    id,
    name: 'Baño completo',
  });
});

it('saves an edited template against its revision', async () => {
  const document = sampleDocument('template');
  api.fetchTemplates.mockResolvedValue([
    { id: 't', revision: 3, createdAt: '2026', updatedAt: '2026', document },
  ]);
  await useTemplateStore.getState().loadTemplates('alice');
  const node = document.tree[0]!.children[0]!;
  await useTemplateStore.getState().updateTemplate('t', updateItem(document, node.id, { quantity: 4 }));
  expect(api.saveTemplate.mock.calls[0]![2]).toBe(3);
  const saved = useTemplateStore.getState().templates[0]!;
  expect(saved.revision).toBe(4);
  expect(templateView(saved).workItems[0]!.tasks[0]!.quantity).toBe(4);
});

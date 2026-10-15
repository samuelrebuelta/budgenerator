import { create } from 'zustand';
import type { BudgetTemplate } from '@/shared/types';
import { isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import { fetchTemplates, saveTemplate, deleteTemplateDoc } from '@/entities/template/api/firestore';

interface TemplateState {
  templates: BudgetTemplate[];
  loaded: boolean;
  loadTemplates: (uid: string) => Promise<void>;
  addTemplate: (template: BudgetTemplate) => Promise<void>;
  updateTemplate: (template: BudgetTemplate) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}

export function setTemplateAuthGetter(_fn: () => string | null) {
  void _fn;
}
function getUid() {
  return sessionUid();
}
export function resetTemplateStore() {
  useTemplateStore.setState({ templates: [], loaded: false });
}

export const useTemplateStore = create<TemplateState>()((set, get) => ({
  templates: [],
  loaded: false,

  loadTemplates: async (uid) => {
    const revision = sessionRevision();
    const templates = await fetchTemplates(uid);
    if (isSessionCurrent(uid, revision)) set({ templates, loaded: true });
  },

  addTemplate: async (template) => {
    const uid = getUid();
    if (!uid) throw new Error('User is not authenticated');
    const revision = sessionRevision();
    await saveTemplate(uid, template);
    if (!isSessionCurrent(uid, revision)) return;
    set({ templates: [...get().templates.filter((t) => t.id !== template.id), template] });
  },

  updateTemplate: async (template) => {
    const uid = getUid();
    if (!uid) throw new Error('User is not authenticated');
    const revision = sessionRevision();
    await saveTemplate(uid, template);
    if (!isSessionCurrent(uid, revision)) return;
    set({ templates: get().templates.map((t) => (t.id === template.id ? template : t)) });
  },

  removeTemplate: async (id) => {
    const uid = getUid();
    if (!uid) return;
    const revision = sessionRevision();
    await deleteTemplateDoc(uid, id);
    if (!isSessionCurrent(uid, revision)) return;
    set({ templates: get().templates.filter((t) => t.id !== id) });
  },
}));

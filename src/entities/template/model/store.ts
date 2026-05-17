import { create } from 'zustand';
import type { BudgetTemplate } from '@/shared/types';
import { auth } from '@/shared/firebase/config';
import { fetchTemplates, saveTemplate, deleteTemplateDoc } from '@/entities/template/api/firestore';

interface TemplateState {
  templates: BudgetTemplate[];
  loaded: boolean;
  loadTemplates: (uid: string) => Promise<void>;
  addTemplate: (template: BudgetTemplate) => Promise<void>;
  updateTemplate: (template: BudgetTemplate) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}

let _getUid: (() => string | null) | null = null;

export function setTemplateAuthGetter(fn: () => string | null) {
  _getUid = fn;
}

function getUid(): string | null {
  return _getUid?.() ?? auth.currentUser?.uid ?? null;
}

export const useTemplateStore = create<TemplateState>()((set, get) => ({
  templates: [],
  loaded: false,

  loadTemplates: async (uid) => {
    const templates = await fetchTemplates(uid);
    set({ templates, loaded: true });
  },

  addTemplate: async (template) => {
    const uid = getUid();
    if (!uid) throw new Error('User is not authenticated');
    await saveTemplate(uid, template);
    set({ templates: [...get().templates, template] });
  },

  updateTemplate: async (template) => {
    const uid = getUid();
    if (!uid) throw new Error('User is not authenticated');
    await saveTemplate(uid, template);
    set({ templates: get().templates.map((t) => (t.id === template.id ? template : t)) });
  },

  removeTemplate: async (id) => {
    const uid = getUid();
    if (!uid) return;
    await deleteTemplateDoc(uid, id);
    set({ templates: get().templates.filter((t) => t.id !== id) });
  },
}));

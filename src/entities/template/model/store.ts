import { create } from 'zustand';
import type { BudgetTemplate } from '@/shared/types';
import { fetchTemplates, saveTemplate, deleteTemplatDoc } from '@/shared/firebase';

interface TemplateState {
  templates: BudgetTemplate[];
  loaded: boolean;
  loadTemplates: (uid: string) => Promise<void>;
  addTemplate: (template: BudgetTemplate) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}

let _getUid: (() => string | null) | null = null;

export function setTemplateAuthGetter(fn: () => string | null) {
  _getUid = fn;
}

function getUid(): string | null {
  return _getUid?.() ?? null;
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
    if (!uid) return;
    await saveTemplate(uid, template);
    set({ templates: [...get().templates, template] });
  },

  removeTemplate: async (id) => {
    const uid = getUid();
    if (!uid) return;
    await deleteTemplatDoc(uid, id);
    set({ templates: get().templates.filter((t) => t.id !== id) });
  },
}));

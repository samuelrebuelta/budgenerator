import { createStore } from 'zustand/vanilla';
import { generateId } from '@bg/domain/lib/utils';
import {
  cloneAsKind,
  emptyBusiness,
  type ConstructionDocument,
} from '@bg/domain/construction-document';
import type { TemplateRecord, TemplateRepository } from '@bg/firebase-api/template';
import { isSessionCurrent, sessionRevision, sessionUid } from '../session.js';
import { registerOfflineStore } from '../offlineStateCache.js';

export interface TemplateState {
  templates: TemplateRecord[];
  loaded: boolean;
  loadTemplates: (uid: string) => Promise<void>;
  /** Creates a template from any document (budget, imported BC3 or draft). */
  createTemplateFrom: (
    document: ConstructionDocument,
    name: string,
    id?: string,
  ) => Promise<string>;
  /** Saves an edited template; rejects when another client saved a newer version. */
  updateTemplate: (id: string, document: ConstructionDocument) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}

/** Templates of the account. */
export function createTemplateStore({ repository }: { repository: TemplateRepository }) {
  const store = createStore<TemplateState>()((set, get) => ({
    templates: [],
    loaded: false,

    loadTemplates: async (uid) => {
      const revision = sessionRevision();
      const templates = await repository.fetchTemplates(uid);
      if (isSessionCurrent(uid, revision))
        set({
          templates: templates.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          loaded: true,
        });
    },

    createTemplateFrom: async (source, name, id = generateId()) => {
      const uid = sessionUid();
      if (!uid) throw new Error('Inicia sesión para continuar.');
      const { business } = source;
      const document =
        source.kind === 'template' && business.name === name.trim()
          ? source
          : cloneAsKind(
              source,
              'template',
              emptyBusiness({
                name: name.trim(),
                ivaRate: business.ivaRate,
                ...(business.adjustment ? { adjustment: { ...business.adjustment } } : {}),
              }),
            );
      const revision = sessionRevision();
      const record = await repository.createTemplate(uid, id, document);
      if (isSessionCurrent(uid, revision))
        set({ templates: [...get().templates.filter((t) => t.id !== record.id), record] });
      return record.id;
    },

    updateTemplate: async (id, document) => {
      const uid = sessionUid();
      if (!uid) throw new Error('Inicia sesión para continuar.');
      const current = get().templates.find((template) => template.id === id);
      if (!current) throw new Error('No se encuentra la plantilla.');
      const session = sessionRevision();
      const next = { ...current, document };
      const revision = await repository.saveTemplate(uid, next, current.revision);
      if (isSessionCurrent(uid, session))
        set({
          templates: get().templates.map((t) =>
            t.id === id ? { ...next, revision, updatedAt: new Date().toISOString() } : t,
          ),
        });
    },

    removeTemplate: async (id) => {
      const uid = sessionUid();
      if (!uid) return;
      const revision = sessionRevision();
      await repository.deleteTemplateDoc(uid, id);
      if (!isSessionCurrent(uid, revision)) return;
      set({ templates: get().templates.filter((t) => t.id !== id) });
    },
  }));

  registerOfflineStore('template-records', store, sessionUid, (state) => ({
    templates: state.templates,
    loaded: state.loaded,
  }));

  return {
    store,
    reset() {
      store.setState({ templates: [], loaded: false });
    },
  };
}

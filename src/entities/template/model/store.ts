import { useMemo } from 'react';
import '@/shared/platform';
import { createTemplateStore } from '@bg/app-core/stores/template';
import { bindStore } from '@/shared/lib/bindStore';
import { RevisionConflictError } from '@/entities/construction-document/api/storage';
import * as templateApi from '../api/firestore';
import { templateView } from './record';

/** Web binding of the shared template store (`@bg/app-core`). */
const template = createTemplateStore({ repository: templateApi });

export const useTemplateStore = bindStore(template.store);
export const resetTemplateStore = template.reset;

export function setTemplateAuthGetter(_fn: () => string | null) {
  void _fn;
}

export function useTemplateViews() {
  const templates = useTemplateStore((s) => s.templates);
  return useMemo(() => templates.map(templateView), [templates]);
}

export { RevisionConflictError };

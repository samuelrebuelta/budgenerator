import '@/shared/platform';
import { createProjectStore } from '@bg/app-core/stores/project';
import { db } from '@/shared/firebase/config';
import { bindStore } from '@/shared/lib/bindStore';
import { useBudgetStore } from '@/entities/budget';
import { createProjectFirestoreApi } from '../api/firestore';

export type { ProjectState } from '@bg/app-core/stores/project';

/** Web binding of the shared project store (`@bg/app-core`). */
const project = createProjectStore({
  repository: createProjectFirestoreApi(db),
  budget: {
    linkProject: (budgetId, projectId, revision) =>
      useBudgetStore.getState().linkProject(budgetId, projectId, revision),
    syncLinkedProjectMetadata: (budgetId, metadata, revision) =>
      useBudgetStore.getState().syncLinkedProjectMetadata(budgetId, metadata, revision),
  },
});

export const useProjectStore = bindStore(project.store);
export const resetProjectStore = project.reset;

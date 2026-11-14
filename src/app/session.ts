import type { User } from 'firebase/auth';
import { sessionDraftStorage } from '@/shared/platform';
import { createSessionCoordinator } from '@bg/app-core/sessionCoordinator';
import { bindStore } from '@/shared/lib/bindStore';
import { useBudgetStore, resetBudgetStore } from '@/entities/budget';
import { useCatalogStore, resetCatalogStore } from '@/entities/catalog';
import { useProfileStore, resetProfileStore } from '@/entities/profile';
import { useProjectStore, resetProjectStore } from '@/entities/project';
import { resetWorkforceStore } from '@/entities/workforce';
import { useTemplateStore, resetTemplateStore } from '@/entities/template';
import { useUserStore, resetUserStore } from '@/entities/user';

/**
 * Web binding of the shared session coordinator (`@bg/app-core`): which stores reset on an
 * account change, which ones a session loads and the project list as the recovery probe.
 */
const coordinator = createSessionCoordinator<User>({
  resetStores() {
    resetBudgetStore();
    resetCatalogStore();
    resetProfileStore();
    resetProjectStore();
    resetWorkforceStore();
    resetTemplateStore();
    resetUserStore();
  },
  loadStores: (user) =>
    Promise.all([
      useUserStore.getState().loadUserData(user.uid, user.email ?? ''),
      useBudgetStore.getState().loadBudgets(user.uid),
      useCatalogStore.getState().loadCatalogs(user.uid, true),
      useProfileStore.getState().loadProfile(user.uid, user.email ?? ''),
      useProjectStore.getState().loadProjects(user.uid, true),
      useTemplateStore.getState().loadTemplates(user.uid),
    ]),
  probe: (user) => useProjectStore.getState().loadProjects(user.uid, true),
  drafts: sessionDraftStorage,
});

export const useSessionStore = bindStore(coordinator.sessionStore);
export const { resetSession, loadSession, probeSessionConnection, prepareSignOut } = coordinator;

export { retryUnauthenticatedRouteConnection } from './sessionModule';

/** True while the budget editor holds an unsaved new budget. */
export function hasBudgetDraft(): boolean {
  return Boolean(useBudgetStore.getState().draft);
}

export function hasDirtyBudgetDraft(): boolean {
  return useBudgetStore.getState().draftDirty;
}

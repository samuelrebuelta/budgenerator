import { takeLegalAcceptance } from '@bg/domain/lib/legal';
import { networkStore } from '@bg/app-core/network';
import { createSessionCoordinator } from '@bg/app-core/sessionCoordinator';
import { createAuthStore } from '@bg/app-core/stores/auth';
import { createBudgetStore } from '@bg/app-core/stores/budget';
import { createCatalogStore } from '@bg/app-core/stores/catalog';
import { createProfileStore } from '@bg/app-core/stores/profile';
import { createProjectStore } from '@bg/app-core/stores/project';
import { createTemplateStore } from '@bg/app-core/stores/template';
import { createUserStore } from '@bg/app-core/stores/user';
import { createWorkforceStore } from '@bg/app-core/stores/workforce';
import { toastStore } from '@bg/app-core/toast';
import {
  installNativePlatform,
  manipulatorLogoNormalizer,
  mmkvDraftStorage,
  type PickedImage,
} from '../platform/appCore';
import type { NativeUser } from '../platform/authSdk';
import { createNativeRepositories } from '../platform/repositories';
import { bindStore } from './bindStore';

/*
 * Native binding of the shared client state (`@bg/app-core`), the mobile counterpart of the web's
 * `src/entities/<entity>/model/store.ts` and `src/app/session.ts`. The platform adapters (MMKV,
 * NetInfo, AppState) are installed before any store registers or writes an offline snapshot.
 */
installNativePlatform();

export const repositories = createNativeRepositories();

export const useAuthStore = bindStore(
  createAuthStore<NativeUser>({ repository: repositories.auth }),
);

const user = createUserStore({ repository: repositories.user, takeLegalAcceptance });
export const useUserStore = bindStore(user.store);

const budget = createBudgetStore({
  repository: repositories.budget,
  acceptance: async () => repositories.budgetAcceptance,
  user: {
    canCreateBudget: () => user.store.getState().canCreateBudget(),
    setUserData: (userData) => user.store.setState({ userData }),
  },
  drafts: mmkvDraftStorage,
});
export const useBudgetStore = bindStore(budget.store);

const catalog = createCatalogStore({ repository: repositories.catalog });
export const useCatalogStore = bindStore(catalog.store);

const profile = createProfileStore<PickedImage>({
  repository: repositories.profile,
  normalizeLogo: manipulatorLogoNormalizer,
});
export const useProfileStore = bindStore(profile.store);

const project = createProjectStore({
  repository: repositories.project,
  budget: {
    linkProject: (budgetId, projectId, revision) =>
      budget.store.getState().linkProject(budgetId, projectId, revision),
    syncLinkedProjectMetadata: (budgetId, metadata, revision) =>
      budget.store.getState().syncLinkedProjectMetadata(budgetId, metadata, revision),
  },
});
export const useProjectStore = bindStore(project.store);

const template = createTemplateStore({ repository: repositories.template });
export const useTemplateStore = bindStore(template.store);

const workforce = createWorkforceStore({ repository: repositories.workforce });
export const useWorkforceStore = bindStore(workforce.store);

/** Same stores, loads and recovery probe as the web's `src/app/session.ts`. */
export const coordinator = createSessionCoordinator<NativeUser>({
  resetStores() {
    budget.reset();
    catalog.reset();
    profile.reset();
    project.reset();
    workforce.reset();
    template.reset();
    user.reset();
  },
  loadStores: (signedIn) =>
    Promise.all([
      user.store.getState().loadUserData(signedIn.uid, signedIn.email ?? ''),
      budget.store.getState().loadBudgets(signedIn.uid),
      catalog.store.getState().loadCatalogs(signedIn.uid, true),
      profile.store.getState().loadProfile(signedIn.uid, signedIn.email ?? ''),
      project.store.getState().loadProjects(signedIn.uid, true),
      template.store.getState().loadTemplates(signedIn.uid),
    ]),
  probe: (signedIn) => project.store.getState().loadProjects(signedIn.uid, true),
  drafts: mmkvDraftStorage,
});

export const useSessionStore = bindStore(coordinator.sessionStore);
export const useNetworkStore = bindStore(networkStore);
export const useToastStore = bindStore(toastStore);

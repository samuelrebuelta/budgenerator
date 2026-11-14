import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { guardNetworkMutation } from '@bg/app-core/networkMutation';
import { createAuthRepository } from '@bg/firebase-api/auth';
import { createBudgetAcceptanceRepository, createBudgetRepository } from '@bg/firebase-api/budget';
import { createCatalogRepository } from '@bg/firebase-api/catalog';
import { createNotificationsRepository } from '@bg/firebase-api/notifications';
import { createProfileRepository } from '@bg/firebase-api/profile';
import { createProjectRepository } from '@bg/firebase-api/project';
import { createTemplateRepository } from '@bg/firebase-api/template';
import { createUserRepository } from '@bg/firebase-api/user';
import { createWorkforceRepository } from '@bg/firebase-api/workforce';
import { nativeAuthSdk, type NativeUser } from './authSdk';
import { nativeFirestoreSdk } from './firestoreSdk';
import { nativeFunctions } from './functions';

/**
 * Shared repositories of `@bg/firebase-api` over React Native Firebase (BG-014 D2), with the
 * offline guard of `@bg/app-core` (BG-012 toast). The Firestore JS instance survives `terminate`
 * (RNFB recreates the native one on the next call), so `resetSession` does not rebuild them.
 */
export function createNativeRepositories() {
  const sdk = nativeFirestoreSdk;
  const database = getFirestore();
  const auth = getAuth();
  const guardMutation = guardNetworkMutation;
  return {
    auth: createAuthRepository<NativeUser>({
      sdk: nativeAuthSdk,
      auth,
      functions: nativeFunctions,
      guardMutation,
    }),
    user: createUserRepository({ sdk, database, guardMutation }),
    budget: createBudgetRepository({
      sdk,
      database,
      guardMutation,
      currentUid: () => auth.currentUser?.uid,
    }),
    budgetAcceptance: createBudgetAcceptanceRepository({ sdk, database, guardMutation }),
    catalog: createCatalogRepository({ sdk, database, guardMutation }),
    profile: createProfileRepository({ sdk, database, guardMutation }),
    project: createProjectRepository({ sdk, database, guardMutation }),
    template: createTemplateRepository({ sdk, database, guardMutation }),
    workforce: createWorkforceRepository({ sdk, database, guardMutation }),
    notifications: createNotificationsRepository({ functions: nativeFunctions, guardMutation }),
  };
}

export type NativeRepositories = ReturnType<typeof createNativeRepositories>;

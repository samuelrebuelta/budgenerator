import type { User } from 'firebase/auth';
import { createAuthStore } from '@bg/app-core/stores/auth';
import * as authApi from '@/entities/auth/api/firebase';
import { bindStore } from '@/shared/lib/bindStore';

/** Web binding of the shared auth store (`@bg/app-core`) over the Firebase JS SDK. */
export const useAuthStore = bindStore(createAuthStore<User>({ repository: authApi }));

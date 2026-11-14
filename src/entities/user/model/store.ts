import '@/shared/platform';
import { createUserStore } from '@bg/app-core/stores/user';
import * as userApi from '@/entities/user/api/firestore';
import { sessionUid } from '@/shared/model/session';
import { bindStore } from '@/shared/lib/bindStore';
import { takeLegalAcceptance } from '@/shared/lib/legal';

export { FREE_BUDGET_LIMIT } from '@/shared/lib/utils';

/** Web binding of the shared user store (`@bg/app-core`). */
const user = createUserStore({ repository: userApi, takeLegalAcceptance });

export const useUserStore = bindStore(user.store);
export const resetUserStore = user.reset;

export function setUserAuthGetter(_fn: () => string) {
  void _fn;
}
export function getUserUid(): string {
  return sessionUid() ?? '';
}

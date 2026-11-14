import { authState, emitAuthUser, fakeUser, type FakeUser } from './fakeRepositories';

/** Signed-in user that the fake auth repository reports first (`null` → signed out). */
export function setMockUser(user: { uid: string } | FakeUser | null) {
  authState.user = user ? fakeUser(user.uid, user as Partial<FakeUser>) : null;
}

export { emitAuthUser, fakeUser };

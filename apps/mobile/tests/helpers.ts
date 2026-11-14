export function setMockUser(user: { uid: string } | null) {
  const auth = (globalThis as { __mockAuth?: { user: { uid: string } | null } }).__mockAuth;
  if (!auth) throw new Error('tests/setup.ts no ha registrado el mock de Auth.');
  auth.user = user;
}

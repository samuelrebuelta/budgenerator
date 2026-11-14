import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/session';

/** Session guard, equivalent to the web's AuthGuard. */
export default function AppLayout() {
  const { status } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

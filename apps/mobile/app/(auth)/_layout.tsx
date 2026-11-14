import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/session';

export default function AuthLayout() {
  const { status } = useSession();
  if (status === 'signedIn') return <Redirect href="/budgets" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

import { Redirect, Stack } from 'expo-router';
import { colors } from '@bg/ui-tokens';
import { useSession } from '../../src/session';

/** Login, registration and password recovery; a signed-in user goes to the entry route (D8). */
export default function AuthLayout() {
  const { status } = useSession();
  if (status === 'signedIn') return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
    />
  );
}

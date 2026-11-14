import { Platform } from 'react-native';
import { Redirect, Stack, type NativeStackNavigationOptions } from 'expo-router';
import { colors } from '@bg/ui-tokens';
import { useSession } from '../../src/session';
import {
  coordinator,
  useAuthStore,
  useNetworkStore,
  useSessionStore,
} from '../../src/state/stores';
import { LoadingScreen } from '../../src/ui';

const OFFLINE_RESTORE = 'Abriendo la última copia guardada…';

/**
 * Account menu (§4.2) as a native sheet. iOS: `formSheet` with medium and large detents and the
 * grabber (Liquid Glass sheet on iOS 26). Android: full-screen modal, because react-native-screens
 * does not support a nested stack (Mi cuenta, placeholders) inside its Material bottom sheet.
 */
const menuPresentation: NativeStackNavigationOptions = Platform.select({
  ios: {
    presentation: 'formSheet',
    sheetAllowedDetents: [0.6, 1],
    sheetGrabberVisible: true,
    sheetInitialDetentIndex: 0,
    contentStyle: { backgroundColor: 'transparent' },
  },
  default: { presentation: 'modal' },
});

/**
 * Session guard, equivalent to the web's `AuthGuard`: no user → login; the workspace opens when
 * the shared coordinator has this account `ready` (offline it opens the last saved copy, BG-012).
 * It also waits for the D3 check that the device holds no other account's data.
 */
export default function AppLayout() {
  const { status, uid, deviceReady, resetError, retryReset } = useSession();
  const session = useSessionStore();
  const online = useNetworkStore((state) => state.online);
  if (status === 'loading')
    return online ? <LoadingScreen /> : <LoadingScreen message={OFFLINE_RESTORE} />;
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (resetError) return <LoadingScreen error={resetError} onRetry={retryReset} />;
  if (!deviceReady || session.uid !== uid || session.status !== 'ready') {
    if (!online) return <LoadingScreen message={OFFLINE_RESTORE} />;
    return (
      <LoadingScreen
        error={session.error}
        onRetry={() => {
          const user = useAuthStore.getState().user;
          if (user) void coordinator.loadSession(user, true);
        }}
      />
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="menu" options={menuPresentation} />
    </Stack>
  );
}

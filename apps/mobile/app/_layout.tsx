// Must stay the first import: @bg/domain needs Intl.PluralRules while it loads.
import '../src/platform/polyfills';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { colors } from '@bg/ui-tokens';
import { initFirebase } from '../src/platform/firebase';
import { registerIdGenerator } from '../src/platform/ids';
import { runtimeSelfCheck } from '../src/platform/runtime';
import { SessionProvider, useSession } from '../src/session';

void SplashScreen.preventAutoHideAsync();
registerIdGenerator();
initFirebase();

if (__DEV__) {
  const failed = runtimeSelfCheck().filter((item) => !item.ok);
  if (failed.length > 0) {
    console.warn(
      `[runtime] Fallan globales de @bg/domain: ${failed.map((item) => item.name).join(', ')}`,
    );
  }
}

function RootNavigator() {
  const { status } = useSession();
  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

/** Root providers: gestures, keyboard, session. Sentry and notifications arrive in phase 2. */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SessionProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

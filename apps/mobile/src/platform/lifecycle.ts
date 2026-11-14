import { AppState } from 'react-native';
import type { LifecyclePort } from '@bg/app-core/ports';

/** Pending offline snapshots are written when the app leaves the foreground. */
export const appStateLifecycle: LifecyclePort = {
  onBackground(listener) {
    AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') listener();
    });
  },
};

import Constants from 'expo-constants';

export type AppVariant = 'development' | 'preview' | 'production';

/** Build variant chosen by `APP_VARIANT` in app.config.ts. */
export const appVariant: AppVariant =
  (Constants.expoConfig?.extra?.appVariant as AppVariant | undefined) ?? 'development';

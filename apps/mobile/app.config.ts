import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config (BG-014 §7.3). `APP_VARIANT` selects the build:
 * - development: dev client against the Firebase emulators of the fictitious `demo-budgenerator`.
 * - preview: internal QA (TestFlight / internal testing) against `budgenerator` with synthetic
 *   accounts only (D5).
 * - production: stores.
 * The three variants have their own bundle id and name so they can live on the same device.
 */
type AppVariant = 'development' | 'preview' | 'production';

const VARIANTS: readonly AppVariant[] = ['development', 'preview', 'production'];
const BASE_ID = 'com.budgenerator.app'; // Provisional until D6 is resolved before phase 4.

function readVariant(): AppVariant {
  const value = process.env.APP_VARIANT ?? 'development';
  if (!(VARIANTS as readonly string[]).includes(value)) {
    throw new Error(`APP_VARIANT inválido: "${value}". Usa ${VARIANTS.join(', ')}.`);
  }
  return value as AppVariant;
}

const variant = readVariant();

const byVariant = {
  development: { name: 'BudGenerator Dev', suffix: '.dev' },
  preview: { name: 'BudGenerator Preview', suffix: '.preview' },
  production: { name: 'BudGenerator', suffix: '' },
} as const satisfies Record<AppVariant, { name: string; suffix: string }>;

/**
 * Firebase native config files. Development uses the versioned files of the fictitious
 * `demo-budgenerator` project. Preview and production take the real files from EAS file
 * environment variables (`GOOGLE_SERVICES_PLIST`, `GOOGLE_SERVICES_JSON`); they are never
 * committed. TODO(BG-014): create the iOS/Android apps in the `budgenerator` Firebase project and
 * upload their files as EAS secrets once the store owner and bundle id are decided (D6).
 */
function firebaseFile(envName: string, devPath: string): string {
  if (variant === 'development') return devPath;
  const path = process.env[envName];
  if (!path) {
    throw new Error(
      `Falta ${envName} para la variante ${variant}: apunta al fichero real de Firebase (secreto de EAS).`,
    );
  }
  return path;
}

const bundleId = `${BASE_ID}${byVariant[variant].suffix}`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: byVariant[variant].name,
  slug: 'budgenerator',
  scheme: 'budgenerator',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light', // No dark mode in v1 (BG-014 exclusions).
  // EAS Update with a fingerprint runtime: OTA updates never reach an incompatible native build.
  runtimeVersion: { policy: 'fingerprint' },
  // TODO(BG-014): `updates.url` and `extra.eas.projectId` need the owner's Expo account
  // (`eas init`); without them EAS Build/Update are not linked yet.
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false, // Phone only in v1 (D9).
    googleServicesFile: firebaseFile(
      'GOOGLE_SERVICES_PLIST',
      './firebase/development/GoogleService-Info.plist',
    ),
    // TODO(BG-014): Team ID, push entitlement, App Attest and associated domains need the Apple
    // Developer licence.
  },
  android: {
    package: bundleId,
    googleServicesFile: firebaseFile(
      'GOOGLE_SERVICES_JSON',
      './firebase/development/google-services.json',
    ),
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#183E3B',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-splash-screen',
      { image: './assets/images/splash-icon.png', imageWidth: 112, backgroundColor: '#F5F2EB' },
    ],
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/Manrope-Regular.ttf',
          './assets/fonts/Manrope-Medium.ttf',
          './assets/fonts/Manrope-SemiBold.ttf',
          './assets/fonts/Manrope-Bold.ttf',
          './assets/fonts/Fraunces-Medium.ttf',
        ],
      },
    ],
    [
      'expo-build-properties',
      {
        // RNFB 27 pulls the Firebase Apple SDK through SPM and needs dynamic frameworks on iOS.
        ios: { useFrameworks: 'dynamic' },
        // Firebase Android BoM 35 (RNFB 27) ships Kotlin 2.4 metadata; RN 0.88 defaults to Kotlin
        // 2.2, which cannot read it (`firebase-auth` fails to compile). 2.3 reads one version ahead.
        android: { kotlinVersion: '2.3.20' },
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    'expo-secure-store',
    'expo-sharing',
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      {
        photosPermission: 'BudGenerator usa tus fotos para añadir el logo de tu empresa.',
        cameraPermission: 'BudGenerator usa la cámara para hacer fotos de obra.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: { appVariant: variant },
});

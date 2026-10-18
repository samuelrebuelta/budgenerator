import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: Object.fromEntries(
      [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID',
      ].map((name) => [`import.meta.env.${name}`, JSON.stringify(env[name] ?? '')]),
    ),
    build: {
      emptyOutDir: false,
      lib: {
        entry: 'src/features/notifications/messaging-sw.ts',
        formats: ['iife'],
        name: 'BudGeneratorMessagingWorker',
        fileName: () => 'fcm-sw.js',
      },
      outDir: 'dist',
    },
  };
});

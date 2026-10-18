import { spawnSync, spawn } from 'node:child_process';
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FUNCTIONS_EMULATOR_HOST
)
  throw new Error('Start the local emulators with pnpm test:integration.');
const projectId = process.env.E2E_FIREBASE_PROJECT_ID ?? 'demo-cimbra';
if (!projectId.startsWith('demo-')) throw new Error('E2E requires a demo Firebase project ID.');
const previewPort = process.env.E2E_PREVIEW_PORT ?? '4173';
if (!/^\d{4,5}$/.test(previewPort)) throw new Error('E2E_PREVIEW_PORT must be a valid port.');
const authAddress = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9199';
const firestoreAddress = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180';
const authEmulatorUrl = `http://${authAddress}`;
const firestoreEmulatorUrl = new URL(`http://${firestoreAddress}`);
const env = {
  ...process.env,
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_STORAGE_BUCKET: `${projectId}.appspot.com`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_APP_ID: '1:123:web:demo',
  VITE_USE_FIREBASE_EMULATORS: 'true',
  VITE_FIREBASE_AUTH_EMULATOR_URL: authEmulatorUrl,
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: firestoreEmulatorUrl.hostname,
  VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: firestoreEmulatorUrl.port || '8180',
};
const result = spawnSync('pnpm', ['build'], { env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const server = spawn(
  'pnpm',
  ['preview', '--host', '127.0.0.1', '--port', previewPort, '--strictPort'],
  { env, stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));

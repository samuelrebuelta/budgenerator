import { spawnSync, spawn } from 'node:child_process';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Start the local emulators with pnpm test:integration.');
const env = {
  ...process.env,
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-cimbra.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-cimbra',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-cimbra.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_APP_ID: '1:123:web:demo',
  VITE_USE_FIREBASE_EMULATORS: 'true',
};
const result = spawnSync('pnpm', ['build'], { env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  env,
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));

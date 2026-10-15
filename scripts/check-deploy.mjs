import { readFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const target = JSON.parse(await readFile('.firebaserc', 'utf8')).projects.default;
if (env.VITE_USE_FIREBASE_EMULATORS === 'true' || env.VITE_FIREBASE_PROJECT_ID?.startsWith('demo-'))
  throw new Error('No se puede desplegar una configuración de emuladores a producción.');
for (const key of [
  'API_KEY',
  'AUTH_DOMAIN',
  'PROJECT_ID',
  'STORAGE_BUCKET',
  'MESSAGING_SENDER_ID',
  'APP_ID',
])
  if (!env[`VITE_FIREBASE_${key}`]) throw new Error(`Falta VITE_FIREBASE_${key}.`);
if (env.VITE_FIREBASE_PROJECT_ID !== target)
  throw new Error('El proyecto del build no coincide con el proyecto de Hosting.');
console.log(`Configuración de producción validada: ${target}.`);

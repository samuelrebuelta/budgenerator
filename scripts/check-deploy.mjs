// Validates the web build configuration and the compiled bundle before a deploy.
// Usage as CLI: node scripts/check-deploy.mjs [--project <alias>] [--bundle]
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';

const REQUIRED_KEYS = [
  'API_KEY',
  'AUTH_DOMAIN',
  'PROJECT_ID',
  'STORAGE_BUCKET',
  'MESSAGING_SENDER_ID',
  'APP_ID',
];

/** Resolves a `.firebaserc` alias (default, staging...) to a project id. */
export async function resolveProject(alias = 'default') {
  const projects = JSON.parse(await readFile('.firebaserc', 'utf8')).projects ?? {};
  const projectId = projects[alias];
  if (!projectId) throw new Error(`El alias "${alias}" no existe en .firebaserc.`);
  if (projectId.includes('CHANGE-ME'))
    throw new Error(
      `El alias "${alias}" usa un id de ejemplo (${projectId}). Crea el proyecto y actualiza .firebaserc.`,
    );
  return { alias, projectId, mode: alias === 'default' ? 'production' : alias };
}

/** Loads `.env`, `.env.<mode>` and their `.local` variants exactly as Vite does. */
export function loadBuildEnv(mode) {
  return { ...loadEnv(mode, process.cwd(), 'VITE_'), ...pickViteEnv(process.env) };
}

function pickViteEnv(source) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => key.startsWith('VITE_')));
}

export function validateBuildEnv(env, projectId) {
  if (
    env.VITE_USE_FIREBASE_EMULATORS === 'true' ||
    env.VITE_FIREBASE_PROJECT_ID?.startsWith('demo-')
  )
    throw new Error('No se puede desplegar una configuración de emuladores.');
  for (const key of REQUIRED_KEYS)
    if (!env[`VITE_FIREBASE_${key}`]) throw new Error(`Falta VITE_FIREBASE_${key}.`);
  if (env.VITE_FIREBASE_PROJECT_ID !== projectId)
    throw new Error(
      `El build apunta a ${env.VITE_FIREBASE_PROJECT_ID} y el destino es ${projectId}.`,
    );
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(full) : [full];
    }),
  );
  return files.flat();
}

/**
 * Inspects the compiled JavaScript in `dist`: every embedded Firebase project id
 * must be the deploy target and no demo/emulator configuration may remain.
 * Prevents a repeat of the 18-10-2026 incident (demo authDomain served in production).
 */
export async function verifyBundle(projectId, env, distDir = 'dist') {
  const files = (await listFiles(distDir)).filter((file) => file.endsWith('.js'));
  const projectIds = new Set();
  let authDomainFound = false;
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/projectId:\s*"([^"]+)"/g)) projectIds.add(match[1]);
    if (env.VITE_FIREBASE_AUTH_DOMAIN && source.includes(env.VITE_FIREBASE_AUTH_DOMAIN))
      authDomainFound = true;
    if (/demo-[a-z0-9-]+\.firebaseapp\.com/.test(source))
      throw new Error(`El bundle ${file} contiene un authDomain demo.`);
  }
  const foreign = [...projectIds].filter((id) => id !== projectId);
  if (projectIds.size === 0 || foreign.length > 0)
    throw new Error(
      `El bundle contiene projectId ${[...projectIds].join(', ') || '(ninguno)'} y el destino es ${projectId}.`,
    );
  if (!authDomainFound) throw new Error('El bundle no contiene el authDomain configurado.');
  return { files: files.length, projectIds: [...projectIds] };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const aliasIndex = args.indexOf('--project');
  const { projectId, mode } = await resolveProject(
    aliasIndex >= 0 ? args[aliasIndex + 1] : 'default',
  );
  const env = loadBuildEnv(mode);
  validateBuildEnv(env, projectId);
  if (args.includes('--bundle')) await verifyBundle(projectId, env);
  console.log(`Configuración de despliegue validada: ${projectId}.`);
}

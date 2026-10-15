import './check-deploy.mjs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const target = JSON.parse(await readFile('.firebaserc', 'utf8')).projects.default;
const only = process.argv[2] ?? 'hosting';
if (!['hosting', 'firestore:rules,hosting'].includes(only))
  throw new Error('Destino de despliegue no admitido.');
for (const args of [
  ['build'],
  ['exec', 'firebase', 'deploy', '--project', target, '--only', only],
]) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

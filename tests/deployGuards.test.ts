import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without type declarations
import { validateBuildEnv, verifyBundle } from '../scripts/check-deploy.mjs';

const env = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'budgenerator.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'budgenerator',
  VITE_FIREBASE_STORAGE_BUCKET: 'budgenerator.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1',
  VITE_FIREBASE_APP_ID: '1:1:web:1',
};
const directories: string[] = [];

async function bundle(source: string) {
  const directory = await mkdtemp(path.join(tmpdir(), 'bg-bundle-'));
  directories.push(directory);
  await mkdir(path.join(directory, 'assets'));
  await writeFile(path.join(directory, 'assets', 'index.js'), source);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('deploy guardrails', () => {
  it('rejects emulator, incomplete or mismatched build configuration', () => {
    expect(() => validateBuildEnv(env, 'budgenerator')).not.toThrow();
    expect(() =>
      validateBuildEnv({ ...env, VITE_USE_FIREBASE_EMULATORS: 'true' }, 'budgenerator'),
    ).toThrow();
    expect(() => validateBuildEnv({ ...env, VITE_FIREBASE_APP_ID: '' }, 'budgenerator')).toThrow();
    expect(() => validateBuildEnv(env, 'budgenerator-staging')).toThrow();
  });

  it('accepts a bundle that only targets the deploy project', async () => {
    const dir = await bundle(
      'const c={apiKey:"key",authDomain:"budgenerator.firebaseapp.com",projectId:"budgenerator"};',
    );
    await expect(verifyBundle('budgenerator', env, dir)).resolves.toMatchObject({ files: 1 });
  });

  it('rejects a bundle built for another or a demo project', async () => {
    const demo = await bundle(
      'const c={authDomain:"demo-bg010-e2e.firebaseapp.com",projectId:"demo-bg010-e2e"};',
    );
    await expect(verifyBundle('budgenerator', env, demo)).rejects.toThrow();
    const other = await bundle(
      'const c={authDomain:"budgenerator.firebaseapp.com",projectId:"budgenerator-staging"};',
    );
    await expect(verifyBundle('budgenerator', env, other)).rejects.toThrow();
  });
});

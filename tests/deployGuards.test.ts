import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('reads the projectId when the bundler emits it as a template literal', async () => {
    const dir = await bundle(
      'const c={apiKey:`key`,authDomain:`budgenerator.firebaseapp.com`,projectId:`budgenerator`};',
    );
    await expect(verifyBundle('budgenerator', env, dir)).resolves.toMatchObject({
      projectIds: ['budgenerator'],
    });
    const other = await bundle(
      'const c={authDomain:`budgenerator.firebaseapp.com`,projectId:`budgenerator-staging`};',
    );
    await expect(verifyBundle('budgenerator', env, other)).rejects.toThrow();
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

describe('deploy CLI', () => {
  const head = 'current-sha';
  const localChecks = [
    'pnpm lint',
    'pnpm format:check',
    'pnpm test',
    'pnpm test:rules:emulator',
    'pnpm test:notifications:emulator',
  ];
  const commands: string[] = [];
  let ciSha: string;
  let conclusion: string;
  const spawn = vi.fn((command: string, args: string[]) => {
    const invocation = [command, ...args].join(' ');
    commands.push(invocation);
    const stdout =
      command === 'gh'
        ? JSON.stringify([{ conclusion, headSha: ciSha }])
        : invocation === 'git rev-parse --abbrev-ref HEAD'
          ? 'main'
          : invocation.startsWith('git rev-parse ')
            ? head
            : '';
    return { status: 0, stdout };
  });

  beforeEach(() => {
    vi.resetModules();
    commands.length = 0;
    ciSha = head;
    conclusion = 'success';
    vi.doMock('node:child_process', () => ({ spawnSync: spawn }));
    vi.doMock('../scripts/check-deploy.mjs', () => ({
      resolveProject: async () => ({ projectId: 'budgenerator', mode: 'production' }),
      pendingLegalData: async () => [],
    }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Despliegue bloqueado');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('node:child_process');
    vi.doUnmock('../scripts/check-deploy.mjs');
  });

  async function deploy(...flags: string[]) {
    const argv = process.argv;
    process.argv = ['node', 'scripts/deploy.mjs', 'functions', ...flags];
    try {
      // @ts-expect-error -- plain ESM script without type declarations
      await import('../scripts/deploy.mjs');
    } finally {
      process.argv = argv;
    }
  }

  it('uses green CI for HEAD and still builds the selected target', async () => {
    await deploy();
    expect(commands.filter((command) => localChecks.includes(command))).toEqual([]);
    expect(commands).toContain('pnpm build:functions');
    expect(commands).toContain('pnpm exec firebase deploy --project budgenerator --only functions');
  });

  it.each(['success', 'failure'])(
    'runs the local checks for a different CI SHA (%s) and blocks production',
    async (previousConclusion) => {
      ciSha = 'previous-sha';
      conclusion = previousConclusion;
      await expect(deploy()).rejects.toThrow('Despliegue bloqueado');
      expect(commands).toEqual(expect.arrayContaining(localChecks));
      expect(commands.some((command) => command.startsWith('pnpm exec firebase deploy'))).toBe(
        false,
      );
    },
  );

  it('blocks a failed CI for HEAD', async () => {
    conclusion = 'failure';
    await expect(deploy()).rejects.toThrow('Despliegue bloqueado');
    expect(commands.some((command) => command.startsWith('pnpm '))).toBe(false);
  });

  it('runs the local checks with --full-checks even when CI is green', async () => {
    await deploy('--full-checks');
    expect(commands).toEqual(expect.arrayContaining(localChecks));
  });

  it('forwards Firebase flags without forwarding --full-checks', async () => {
    await deploy('--force', '--non-interactive', '--full-checks');
    expect(commands.at(-1)).toBe(
      'pnpm exec firebase deploy --project budgenerator --only functions --force --non-interactive',
    );
  });
});

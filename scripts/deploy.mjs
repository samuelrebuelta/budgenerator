// Guarded deploy for BudGenerator.
//
//   node scripts/deploy.mjs <targets> [--project <alias>]
//
// The browser suite (`pnpm test:integration`) runs in CI; production requires that
// the last CI run on main is green and belongs to the commit being deployed.
//
// targets: comma-separated list of hosting, rules, indexes, functions, or "all".
// alias:   a key of .firebaserc ("default" = production, "staging" = staging).
//
// Guardrails, in order: known targets and project, clean Git tree, production only
// from an up-to-date `main`, lint/format/unit/rules tests green, functions build,
// web build with the target project's env, and a bundle check of the projectId.
import { spawnSync } from 'node:child_process';
import { loadBuildEnv, resolveProject, validateBuildEnv, verifyBundle } from './check-deploy.mjs';

const TARGETS = {
  hosting: 'hosting',
  rules: 'firestore:rules',
  indexes: 'firestore:indexes',
  functions: 'functions',
};

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  console.log(`\n▶ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) fail(`Falló: ${command} ${args.join(' ')}`);
}

function output(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

const args = process.argv.slice(2);
const requested = (args[0] ?? '').split(',').filter(Boolean);
const aliasIndex = args.indexOf('--project');
const alias = aliasIndex >= 0 ? args[aliasIndex + 1] : 'default';
const targets = requested.includes('all') ? Object.keys(TARGETS) : requested;
if (targets.length === 0 || targets.some((target) => !(target in TARGETS)))
  fail(`Indica destinos válidos: ${Object.keys(TARGETS).join(', ')} o all.`);

const { projectId, mode } = await resolveProject(alias);
const production = alias === 'default';
console.log(`Destino: ${projectId} (${alias}); objetivos: ${targets.join(', ')}.`);

// 1. Git state: never deploy uncommitted or unmerged code.
if (output('git', ['status', '--porcelain']) !== '')
  fail('El árbol de Git tiene cambios sin confirmar. Confirma o descarta antes de desplegar.');
if (production) {
  const branch = output('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') fail(`Producción solo se despliega desde main (rama actual: ${branch}).`);
  run('git', ['fetch', '--quiet', 'origin', 'main']);
  if (output('git', ['rev-parse', 'HEAD']) !== output('git', ['rev-parse', 'origin/main']))
    fail('main local no coincide con origin/main. Integra y publica antes de desplegar.');
  const ci = output('gh', [
    'run',
    'list',
    '--branch',
    'main',
    '--limit',
    '1',
    '--json',
    'conclusion,headSha',
  ]);
  if (ci === null)
    console.warn('⚠ No se pudo consultar la CI con gh; revisa el último run de main.');
  else {
    const [last] = JSON.parse(ci);
    if (last?.conclusion !== 'success') fail('El último run de CI en main no está en verde.');
    if (last.headSha !== output('git', ['rev-parse', 'HEAD']))
      fail('El último run de CI no corresponde al commit que se va a desplegar.');
  }
}

// 2. Web env for the target project, validated before spending time on tests.
const env = loadBuildEnv(mode);
if (targets.includes('hosting')) validateBuildEnv(env, projectId);

// 3. Tests and builds. Rules tests use the alternative emulator ports.
run('pnpm', ['lint']);
run('pnpm', ['format:check']);
run('pnpm', ['test']);
run('pnpm', ['test:rules:emulator']);
if (targets.includes('functions')) {
  run('pnpm', ['build:functions']);
  run('pnpm', ['test:notifications:emulator']);
}

if (targets.includes('hosting')) {
  run('pnpm', ['build'], { env: { ...process.env, ...env } });
  const bundle = await verifyBundle(projectId, env);
  console.log(`Bundle verificado: ${bundle.files} ficheros JS apuntan a ${projectId}.`);
}

// 4. Deploy.
const only = targets.map((target) => TARGETS[target]).join(',');
run('pnpm', ['exec', 'firebase', 'deploy', '--project', projectId, '--only', only]);
console.log(`\n✔ Desplegado ${only} en ${projectId}.`);

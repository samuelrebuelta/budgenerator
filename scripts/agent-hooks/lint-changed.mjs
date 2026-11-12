#!/usr/bin/env node
// Hook PostToolUse: ESLint y Prettier solo sobre el fichero editado. Salida corta.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

let filePath;
try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  filePath = input?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath || !existsSync(filePath)) process.exit(0);

const rel = relative(process.cwd(), filePath);
if (rel.startsWith('..') || rel.includes('node_modules') || rel.startsWith('dist')) process.exit(0);

const problems = [];
const run = (cmd, args) => {
  try {
    execFileSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
  } catch (error) {
    const out = `${error.stdout ?? ''}${error.stderr ?? ''}`
      .trim()
      .split('\n')
      .slice(0, 20)
      .join('\n');
    problems.push(out);
  }
};

if (/\.(ts|tsx|js|mjs)$/.test(rel)) run('pnpm', ['exec', 'eslint', '--max-warnings=0', rel]);
if (/\.(ts|tsx|js|mjs|json|css|md)$/.test(rel)) run('pnpm', ['exec', 'prettier', '--check', rel]);

if (problems.length > 0) {
  process.stderr.write(`Comprobación de ${rel}:\n${problems.join('\n')}\n`);
  process.exit(2);
}

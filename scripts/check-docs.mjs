#!/usr/bin/env node
// Comprueba enlaces Markdown relativos rotos y que cada spec declare su estado.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const roots = ['AGENTS.md', 'CLAUDE.md', 'README.md', 'docs'];
const skip = /(^|\/)(archive|testing-evidence|analysis)(\/|$)/;
const files = [];
const walk = (path) => {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry));
  } else if (path.endsWith('.md') && !skip.test(path)) files.push(path);
};
roots.forEach(walk);

const errors = [];
const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g;
for (const file of files) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const [, target] of text.matchAll(linkPattern)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const clean = decodeURIComponent(target.split('#')[0]).replace(/:\d+(-\d+)?$/, '');
    if (!clean) continue;
    if (!existsSync(resolve(dirname(file), clean))) errors.push(`${file}: enlace roto → ${target}`);
  }
  if (/^docs\/specs\/(?!README|_template|plans\/)[^/]+\.md$/.test(file)) {
    if (!/^(Estado|\*\*Estado)/m.test(text)) errors.push(`${file}: falta la línea «Estado:»`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problema(s) de documentación.`);
  process.exit(1);
}
console.log(`Documentación correcta (${files.length} ficheros).`);

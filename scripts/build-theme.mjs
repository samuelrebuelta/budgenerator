// Generates the web `@theme` block from @bg/ui-tokens (single source of truth).
// Usage: `node scripts/build-theme.mjs` (write) or `--check` (fail if out of sync).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderTheme } from '../packages/ui-tokens/src/css.ts';

const target = fileURLToPath(new URL('../src/app/styles/theme.generated.css', import.meta.url));
const css = renderTheme();

if (process.argv.includes('--check')) {
  if (!existsSync(target) || readFileSync(target, 'utf8') !== css) {
    console.error('theme.generated.css is out of sync: run `pnpm theme`.');
    process.exit(1);
  }
} else if (!existsSync(target) || readFileSync(target, 'utf8') !== css) {
  writeFileSync(target, css);
  console.log('theme.generated.css written');
}

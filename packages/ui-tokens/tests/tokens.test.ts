import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderTheme } from '../src/css.ts';
import { colors, deprecatedBlueAlias, radii, shadows, tokens } from '../src/index.ts';
import { nativeShadows } from '../src/native.ts';

const generatedPath = new URL('../../../src/app/styles/theme.generated.css', import.meta.url);

/** `--name: value;` declarations of the `@theme` block. */
function declarations(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) out[m[1]!] = m[2]!;
  return out;
}

describe('@bg/ui-tokens CSS generation', () => {
  it('keeps src/app/styles/theme.generated.css in sync with the tokens (run `pnpm theme`)', () => {
    expect(readFileSync(generatedPath, 'utf8')).toBe(renderTheme());
  });

  it('is imported by the global stylesheet and no longer duplicated in tokens.css', () => {
    const index = readFileSync(new URL('../../../src/index.css', import.meta.url), 'utf8');
    const tokensCss = readFileSync(
      new URL('../../../src/app/styles/tokens.css', import.meta.url),
      'utf8',
    );
    expect(index).toContain("@import './app/styles/theme.generated.css';");
    expect(tokensCss).not.toContain('@theme {');
  });

  it('emits one CSS variable per colour plus the deprecated blue alias', () => {
    const vars = declarations(renderTheme());
    for (const [name, value] of Object.entries(colors)) {
      expect(vars[`--color-${name}`]).toBe(value);
    }
    for (const step of deprecatedBlueAlias.steps) {
      expect(vars[`--color-blue-${step}`]).toBe(`var(--color-brand-${step})`);
    }
  });

  it('reproduces the web values for radii, shadows, breakpoint and display size', () => {
    const vars = declarations(renderTheme());
    expect(vars['--radius-control']).toBe('0.5rem');
    expect(vars['--radius-card']).toBe('0.875rem');
    expect(vars['--radius-sheet']).toBe('1rem');
    expect(vars['--radius-pill']).toBe('9999px');
    expect(vars['--shadow-card']).toBe('0 1px 2px rgb(16 45 43 / 0.06)');
    expect(vars['--shadow-popover']).toBe('0 12px 36px rgb(20 45 35 / 0.18)');
    expect(vars['--shadow-toast']).toBe('0 8px 35px rgb(16 45 43 / 0.15)');
    expect(vars['--shadow-modal']).toBe('0 30px 100px rgb(16 45 43 / 0.13)');
    expect(vars['--breakpoint-shell']).toBe('50.0625rem');
    expect(vars['--text-display']).toBe('clamp(1.75rem, 3.1vw, 2.5rem)');
    expect(vars['--text-display--line-height']).toBe('1.18');
    expect(vars['--font-sans']).toBe("'Manrope Variable', system-ui, sans-serif");
    expect(vars['--font-display']).toBe("'Fraunces Variable', Georgia, serif");
  });
});

describe('@bg/ui-tokens native formats', () => {
  it('uses only hex colours that React Native understands (#rgb, #rrggbb, #rrggbbaa)', () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(value, name).toMatch(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
    }
  });

  it('uses unitless px numbers for radii, breakpoints, display size and spacing', () => {
    for (const v of Object.values(radii)) expect(Number.isFinite(v)).toBe(true);
    expect(tokens.breakpoints.shell).toBe(801);
    expect(tokens.display.min).toBeLessThan(tokens.display.max);
    for (const v of Object.values(tokens.spacing)) expect(Number.isFinite(v)).toBe(true);
  });

  it('exposes the semantic tokens the web relies on', () => {
    for (const name of ['ink', 'canvas', 'line', 'line-strong', 'surface', 'primary', 'accent']) {
      expect(colors).toHaveProperty(name);
    }
  });

  it('converts shadows to React Native props', () => {
    expect(nativeShadows.card).toEqual({
      shadowColor: '#102d2b',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 1,
      elevation: 1,
    });
    expect(nativeShadows.popover.shadowColor).toBe('#142d23');
    for (const s of Object.values(shadows)) {
      expect(s.alpha).toBeGreaterThan(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/shared/ui/Button';

describe('Button', () => {
  it('shows a spinner and stays disabled while loading', () => {
    const markup = renderToStaticMarkup(createElement(Button, { loading: true }, 'Guardar'));

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('lucide-loader-circle');
    expect(markup).toContain('Guardar');
  });

  it('does not show a spinner when disabled for another reason', () => {
    const markup = renderToStaticMarkup(createElement(Button, { disabled: true }, 'Guardar'));

    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('lucide-loader-circle');
    expect(markup).not.toContain('aria-busy="true"');
  });
});

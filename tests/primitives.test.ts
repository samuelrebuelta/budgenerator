import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/shared/ui/Button';
import { IconButton } from '../src/shared/ui/IconButton';
import { Input } from '../src/shared/ui/Input';
import { Alert } from '../src/shared/ui/Alert';
import { Badge } from '../src/shared/ui/Badge';
import { CollapsibleSection } from '../src/shared/ui/CollapsibleSection';
import { EmptyState } from '../src/shared/ui/EmptyState';

describe('shared/ui primitives', () => {
  it('renders Button variants and sizes as component classes', () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { variant: 'outline', size: 'sm', fullWidth: true }, 'Guardar'),
    );
    expect(markup).toContain('ui-button ui-button--outline ui-button--sm ui-button--full');
    expect(markup).toContain('type="button"');
  });

  it('requires an accessible name on IconButton', () => {
    const markup = renderToStaticMarkup(
      createElement(IconButton, { label: 'Cerrar', icon: createElement('svg') }),
    );
    expect(markup).toContain('aria-label="Cerrar"');
    expect(markup).toContain('ui-button--icon');
  });

  it('connects label, hint and error of a field', () => {
    const markup = renderToStaticMarkup(
      createElement(Input, { label: 'Nombre', hint: 'Como aparecerá', error: 'Obligatorio' }),
    );
    const id = /<input id="([^"]+)"/.exec(markup)?.[1];
    expect(id).toBeTruthy();
    expect(markup).toContain(`for="${id}"`);
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain(`aria-describedby="${id}-hint ${id}-error"`);
    expect(markup).toContain('role="alert"');
  });

  it('uses alert for errors and status for confirmations', () => {
    expect(renderToStaticMarkup(createElement(Alert, { tone: 'danger' }, 'Error'))).toContain(
      'role="alert"',
    );
    expect(renderToStaticMarkup(createElement(Alert, { tone: 'success' }, 'Hecho'))).toContain(
      'role="status"',
    );
    expect(renderToStaticMarkup(createElement(Badge, { tone: 'warning' }, 'Pendiente'))).toContain(
      'bg-warning-surface',
    );
  });

  it('exposes collapsible state with a real button', () => {
    const markup = renderToStaticMarkup(
      createElement(CollapsibleSection, { title: 'Capítulo' }, 'Contenido'),
    );
    expect(markup).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="collapsible-/);
    expect(markup).toContain('inert');
    expect(
      renderToStaticMarkup(createElement(EmptyState, { title: 'Sin trabajos', headingLevel: 3 })),
    ).toContain('<h3');
  });
});

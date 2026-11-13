import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENTS, LEGAL_HOLDER, pendingLegalData } from '../src/pages/legal/legalContent';

describe('textos legales', () => {
  it('publica los cuatro documentos con secciones y párrafos', () => {
    expect(Object.keys(LEGAL_DOCUMENTS).sort()).toEqual([
      'aviso-legal',
      'condiciones',
      'cookies',
      'privacidad',
    ]);
    for (const document of Object.values(LEGAL_DOCUMENTS)) {
      expect(document.sections.length).toBeGreaterThan(0);
      for (const section of document.sections) {
        expect(section.heading).not.toBe('');
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });

  it('enumera los datos del titular y las decisiones que faltan', () => {
    const pending = pendingLegalData();
    // Todavía sin rellenar: el despliegue a producción lo bloquea (scripts/deploy.mjs).
    expect(pending).toContain(LEGAL_HOLDER.name);
    expect(pending).toContain(LEGAL_HOLDER.taxId);
    expect(pending.some((item) => item.includes('artículo 28 RGPD'))).toBe(true);
    expect(pending).toEqual([...pending].sort());
  });

  it('deja de señalar un dato en cuanto se rellena', () => {
    const filled = { ...LEGAL_HOLDER, name: 'Reformas García, S.L.' };
    expect(Object.values(filled).filter((value) => value.includes('COMPLETAR'))).toHaveLength(
      Object.keys(LEGAL_HOLDER).length - 1,
    );
  });
});

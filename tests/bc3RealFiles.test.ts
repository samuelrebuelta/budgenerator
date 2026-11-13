import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBc3 } from '../src/entities/construction-document/bc3';

/**
 * Ficheros BC3 generados por Presto y por Arquímedes, no por nosotros: traen las manías
 * del mundo real (registros partidos en varias líneas, conceptos de porcentaje, extensiones
 * propietarias). No se versionan, porque pesan decenas de MB y se publican sin licencia de
 * redistribución; apunta `BC3_REAL_DIR` a una carpeta que los contenga para ejecutarlos.
 *
 * Fuentes: base de precios de la Junta de Extremadura 2026 (Presto 25.01) y proyecto del
 * CEIP Villimar de la Junta de Castilla y León (Arquímedes de CYPE).
 */
const directory = process.env.BC3_REAL_DIR;
const path = (name: string) => `${directory}/${name}`;
const missing = (name: string) => !directory || !existsSync(path(name));
const bytes = (name: string) => new Uint8Array(readFileSync(path(name)));
const errors = (result: ReturnType<typeof parseBc3>) =>
  result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.code);

const PRESTO = 'BCEXTGREM_26_v1.bc3';
const ARQUIMEDES = '1725-V7-CEIP_VILLIMAR.bc3';

describe('BC3 de Presto: base de precios de Extremadura 2026', () => {
  it.skipIf(missing(PRESTO))(
    'importa 60.000 conceptos al catálogo sin errores que bloqueen',
    () => {
      const result = parseBc3(bytes(PRESTO), { target: 'catalog' });
      expect(result.summary).toMatchObject({
        program: 'Presto 25.01',
        version: 'FIEBDC-3/2020',
        charset: 'ANSI',
      });
      expect(result.summary.concepts).toBeGreaterThan(60_000);
      expect(result.summary.chapters).toBeGreaterThan(6_000);
      // Extensiones propietarias de Presto: se conservan para volver a exportarlas.
      expect(result.summary.extensionTypes).toEqual(['~L', '~X', '~A', '~E']);
      expect(errors(result)).toEqual([]);
    },
    180_000,
  );
});

describe('BC3 de Arquímedes: proyecto del CEIP Villimar', () => {
  it.skipIf(missing(ARQUIMEDES))(
    'lee la estructura con registros partidos en varias líneas',
    () => {
      const result = parseBc3(bytes(ARQUIMEDES), { target: 'budget', today: '2026-11-13' });
      expect(result.summary).toMatchObject({
        program: 'ARQUIMEDES',
        version: 'FIEBDC-3/2004',
        charset: 'ANSI',
        declaredTotal: 4_947_480.3,
      });
      // Los ~D y los ~M de Arquímedes ocupan varias líneas; si el lector fuera línea a línea,
      // estos recuentos saldrían a cero.
      expect(result.summary.chapters).toBe(154);
      expect(result.summary.items).toBe(744);
      expect(result.summary.measuredItems).toBe(553);
      expect(result.summary.composedConcepts).toBe(756);
    },
  );

  it.skipIf(missing(ARQUIMEDES))('se importa con los precios declarados en el archivo', () => {
    const result = parseBc3(bytes(ARQUIMEDES), { target: 'budget', today: '2026-11-13' });
    // BG-016: nada bloquea la importación y el importe es el del archivo.
    expect(errors(result)).toEqual([]);
    expect(result.document).not.toBeNull();
    expect(result.summary.computedTotal).toBe(result.summary.declaredTotal);
    // El archivo se contradice consigo mismo y eso se avisa, sin bloquear.
    expect(result.diagnostics.map((item) => item.code)).toContain('price-mismatch');
  });
});

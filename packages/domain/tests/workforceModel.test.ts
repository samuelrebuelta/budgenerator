import { describe, expect, it } from 'vitest';
import {
  normalizeWorkforceName,
  validateCrewInput,
  validateMemberName,
} from '../src/workforce/validation';
import type { WorkforceMember } from '../src/workforce/types';

const members: WorkforceMember[] = [
  { id: 'm1', name: 'Ana Pérez', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'm2', name: 'Luis Díaz', status: 'inactive', createdAt: '', updatedAt: '' },
];

describe('workforce validation', () => {
  it('trims names and collapses repeated whitespace', () => {
    expect(normalizeWorkforceName('  Ana   María  Pérez ')).toBe('Ana María Pérez');
  });

  it('rejects blank member names', () => {
    expect(() => validateMemberName('  \t  ')).toThrow(/nombre/i);
  });

  it('rejects member names over 100 characters', () => {
    expect(() => validateMemberName('a'.repeat(101))).toThrow(/100/);
  });

  it('returns a normalized member name', () => {
    expect(validateMemberName('  Ana   Pérez ')).toBe('Ana Pérez');
  });

  it('normalizes a valid crew label and removes duplicate member IDs', () => {
    expect(
      validateCrewInput(
        { label: '  Alba   mañana ', color: 'blue', memberIds: ['m1', 'm1', 'm2'] },
        members,
      ),
    ).toEqual({ label: 'Alba mañana', color: 'blue', memberIds: ['m1', 'm2'] });
  });

  it('rejects blank and oversized crew labels', () => {
    expect(() =>
      validateCrewInput({ label: ' ', color: 'blue', memberIds: ['m1'] }, members),
    ).toThrow(/etiqueta/i);
    expect(() =>
      validateCrewInput({ label: 'a'.repeat(61), color: 'blue', memberIds: ['m1'] }, members),
    ).toThrow(/60/);
  });

  it('rejects an unknown crew color', () => {
    expect(() =>
      validateCrewInput({ label: 'Alba', color: 'black', memberIds: ['m1'] }, members),
    ).toThrow(/color/i);
  });

  it('rejects unknown member IDs', () => {
    expect(() =>
      validateCrewInput({ label: 'Alba', color: 'blue', memberIds: ['missing'] }, members),
    ).toThrow(/persona/i);
  });

  it('rejects an empty member list', () => {
    expect(() =>
      validateCrewInput({ label: 'Alba', color: 'blue', memberIds: [] }, members),
    ).toThrow(/persona/i);
  });

  it('requires an active member when creating a crew', () => {
    expect(() =>
      validateCrewInput({ label: 'Tarde', color: 'green', memberIds: ['m2'] }, members),
    ).toThrow(/activa/i);
  });
});

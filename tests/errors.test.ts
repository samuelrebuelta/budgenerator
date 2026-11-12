import { describe, expect, it } from 'vitest';
import { toUserMessage, UserFacingError } from '../src/shared/lib/errors';

class FakeFirebaseError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

describe('toUserMessage', () => {
  it('shows messages written for the user', () => {
    expect(toUserMessage(new UserFacingError('Escribe un nombre.'))).toBe('Escribe un nombre.');
    expect(toUserMessage(new Error('Añade al menos una persona.'))).toBe(
      'Añade al menos una persona.',
    );
  });

  it('classifies Firebase errors by code and hides their technical message', () => {
    const denied = new FakeFirebaseError(
      'permission-denied',
      'Missing or insufficient permissions.',
    );
    expect(toUserMessage(denied)).toBe('No tienes permiso para realizar esta acción.');
    expect(toUserMessage(denied, { permissionDenied: 'Sin acceso.' })).toBe('Sin acceso.');
    expect(toUserMessage(new FakeFirebaseError('unavailable', 'client is offline'))).toMatch(
      /conexión/,
    );
    expect(toUserMessage(new FakeFirebaseError('internal', 'INTERNAL'), 'Falló.')).toBe('Falló.');
  });

  it('never shows library or unknown errors', () => {
    expect(toUserMessage(new TypeError('Failed to fetch'))).toMatch(/conexión/);
    expect(toUserMessage(new RangeError('Invalid array length'), 'Falló.')).toBe('Falló.');
    expect(toUserMessage('boom', 'Falló.')).toBe('Falló.');
  });
});

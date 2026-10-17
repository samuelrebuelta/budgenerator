import { expect, it } from 'vitest';
import {
  isWelcomeTourPending,
  markWelcomeTourComplete,
  markWelcomeTourPending,
} from '../src/features/app-tour/model';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

it('starts the welcome tour only for a pending, not-yet-completed account', () => {
  const session = memoryStorage();
  const local = memoryStorage();
  markWelcomeTourPending('new-user', session);

  expect(isWelcomeTourPending('new-user', session, local)).toBe(true);
  expect(isWelcomeTourPending('existing-user', session, local)).toBe(false);

  markWelcomeTourComplete('new-user', session, local);
  expect(isWelcomeTourPending('new-user', session, local)).toBe(false);
  expect(session.length).toBe(0);
});

it('still reads the session marker if persistent storage is blocked', () => {
  const session = memoryStorage();
  markWelcomeTourPending('session-user', session);
  markWelcomeTourPending('other-user', memoryStorage());
  const blockedLocal = {
    getItem: () => {
      throw new Error('storage blocked');
    },
  };

  expect(isWelcomeTourPending('session-user', session, blockedLocal)).toBe(true);
});

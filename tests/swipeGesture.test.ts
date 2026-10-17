import { expect, it } from 'vitest';
import { swipeDirection } from '../src/shared/ui/swipeGesture';
it('reveals only deliberate horizontal gestures', () => {
  expect(swipeDirection(-90, 5, false)).toBe(null);
  expect(swipeDirection(-90, 5, true)).toBe(null);
  expect(swipeDirection(90, 5, true)).toBe('right');
  expect(swipeDirection(90, 5, false)).toBe(null);
  expect(swipeDirection(20, 3, true)).toBe(null);
  expect(swipeDirection(70, 100, true)).toBe(null);
  expect(swipeDirection(NaN, 0, true)).toBe(null);
});

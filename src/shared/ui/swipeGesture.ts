export type SwipeDirection = 'left' | 'right' | null;
export function swipeDirection(dx: number, dy: number, allowRight: boolean): SwipeDirection {
  if (
    !Number.isFinite(dx) ||
    !Number.isFinite(dy) ||
    Math.abs(dx) < 56 ||
    Math.abs(dx) <= Math.abs(dy) * 1.4
  )
    return null;
  return dx > 0 && allowRight ? 'right' : null;
}

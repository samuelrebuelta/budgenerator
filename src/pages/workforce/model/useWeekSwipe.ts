import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type TransitionEvent as ReactTransitionEvent,
} from 'react';
import { shiftWeeks } from '@/shared/lib';

export type WeekSlideDirection = 'next' | 'previous';

export interface WeekSwipeState {
  /** -1 while a button-driven slide animates. */
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  offset: number;
  direction: WeekSlideDirection | null;
  phase: 'dragging' | 'settling';
  commit: boolean;
  targetWeekStart: Date | null;
  targetSelectedDayIndex?: number;
}

interface UseWeekSwipeOptions {
  surfaceRef: RefObject<HTMLElement | null>;
  weekStart: Date;
  disabled: boolean;
  /** Called when a swipe or slide lands on another week. */
  onCommit: (weekStart: Date, selectedDayIndex?: number) => void;
}

const SETTLE_TRANSITION = 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)';
const DRAG_SLOP = 8;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Commit distance: 22 % of the surface, between 56 and 120 px. */
export function swipeCommitThreshold(width: number) {
  return Math.max(56, Math.min(120, width * 0.22));
}

/**
 * Horizontal week swipe that follows the pointer, keeps native vertical scrolling and either
 * commits to the adjacent week or settles back. Buttons reuse the same slide animation.
 */
export function useWeekSwipe({ surfaceRef, weekStart, disabled, onCommit }: UseWeekSwipeOptions) {
  const [swipe, setSwipe] = useState<WeekSwipeState | null>(null);
  const [slideDirection, setSlideDirection] = useState<WeekSlideDirection | null>(null);
  const swipeRef = useRef<WeekSwipeState | null>(null);

  const update = (next: WeekSwipeState | null) => {
    swipeRef.current = next;
    setSwipe(next);
  };

  const finish = (state: WeekSwipeState) => {
    if (state.commit && state.targetWeekStart) {
      setSlideDirection(state.direction);
      onCommit(state.targetWeekStart, state.targetSelectedDayIndex);
    }
    update(null);
  };

  /** Animates to `target`; returns false while another slide is running. */
  const slideTo = (
    target: Date,
    direction: WeekSlideDirection,
    targetSelectedDayIndex?: number,
  ): boolean => {
    if (swipeRef.current) return false;
    const width = surfaceRef.current?.clientWidth ?? 0;
    setSlideDirection(direction);
    if (width === 0 || prefersReducedMotion()) {
      onCommit(target, targetSelectedDayIndex);
      return true;
    }
    update({
      pointerId: -1,
      startX: 0,
      startY: 0,
      width,
      offset: 0,
      direction,
      phase: 'dragging',
      commit: true,
      targetWeekStart: target,
      targetSelectedDayIndex,
    });
    requestAnimationFrame(() => {
      const current = swipeRef.current;
      if (!current || current.pointerId !== -1) return;
      update({ ...current, phase: 'settling', offset: direction === 'next' ? -width : width });
    });
    return true;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || !event.isPrimary || event.button !== 0 || swipeRef.current) return;
    if (event.target instanceof Element && event.target.closest('[data-week-swipe-ignore]')) return;
    const width = event.currentTarget.clientWidth;
    if (width === 0) return;
    update({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width,
      offset: 0,
      direction: null,
      phase: 'dragging',
      commit: false,
      targetWeekStart: null,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = swipeRef.current;
    if (
      !current ||
      current.pointerId === -1 ||
      current.pointerId !== event.pointerId ||
      current.phase !== 'dragging'
    )
      return;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (!current.direction && Math.abs(deltaX) < DRAG_SLOP && Math.abs(deltaY) < DRAG_SLOP) return;
    if (!current.direction && Math.abs(deltaY) > Math.abs(deltaX)) {
      update(null);
      return;
    }
    if (Math.abs(deltaX) < DRAG_SLOP) return;
    event.preventDefault();
    if (!event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.setPointerCapture(event.pointerId);
    update({ ...current, direction: deltaX < 0 ? 'next' : 'previous', offset: deltaX });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const current = swipeRef.current;
    if (
      !current ||
      current.pointerId === -1 ||
      current.pointerId !== event.pointerId ||
      current.phase !== 'dragging'
    )
      return;
    if (!current.direction) {
      update(null);
      return;
    }
    const commit = Math.abs(current.offset) >= swipeCommitThreshold(current.width);
    const target = shiftWeeks(weekStart, current.direction === 'next' ? 1 : -1);
    if (prefersReducedMotion()) {
      update(null);
      if (commit) {
        setSlideDirection(current.direction);
        onCommit(target);
      }
      return;
    }
    update({
      ...current,
      phase: 'settling',
      commit,
      targetWeekStart: commit ? target : null,
      offset: commit ? (current.direction === 'next' ? -current.width : current.width) : 0,
    });
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    const current = swipeRef.current;
    if (!current || current.pointerId === -1 || current.pointerId !== event.pointerId) return;
    update(null);
  };

  const onTransitionEnd = (event: ReactTransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    const current = swipeRef.current;
    if (current?.phase === 'settling') finish(current);
  };

  /** Inline style of a sliding week; `preview` is the incoming week next to the current one. */
  const slideStyle = (preview: boolean) => {
    const offset = swipe?.offset ?? 0;
    const base = preview && swipe ? (swipe.direction === 'next' ? swipe.width : -swipe.width) : 0;
    return {
      transform: `translate3d(${base + offset}px, 0, 0)`,
      transition: swipe?.phase === 'settling' ? SETTLE_TRANSITION : 'none',
    };
  };

  return {
    swipe,
    slideDirection,
    slideTo,
    isSliding: () => swipeRef.current !== null,
    slideStyle,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    onTransitionEnd,
  };
}

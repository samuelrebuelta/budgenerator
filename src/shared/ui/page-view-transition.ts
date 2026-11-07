import { useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  resolvePath,
  useLocation,
  useNavigate,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from 'react-router-dom';

export type PageViewTransitionDirection = 'forward' | 'back';

const PRIMARY_TAB_PATHS = new Set(['/budgets', '/projects', '/team', '/profile/solicitudes', '/']);

function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function isPrimaryTabPath(pathname: string): boolean {
  return PRIMARY_TAB_PATHS.has(normalizePathname(pathname));
}

export function getPageReturnTab(state: unknown): string | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const returnTab = (state as Record<string, unknown>).returnTab;
  return typeof returnTab === 'string' && isPrimaryTabPath(returnTab)
    ? normalizePathname(returnTab)
    : null;
}

export function resolvePageBackPath(backTo: string, state: unknown): string {
  const returnTab = getPageReturnTab(state);
  return returnTab && isPrimaryTabPath(backTo) ? returnTab : backTo;
}

export function preservePageReturnTab(
  currentState: unknown,
  nextState: unknown,
  destinationPath: string,
): unknown {
  if (isPrimaryTabPath(destinationPath)) return nextState;

  const returnTab = getPageReturnTab(currentState);
  if (!returnTab) return nextState;
  if (nextState && typeof nextState === 'object' && !Array.isArray(nextState)) {
    return {
      ...(nextState as Record<string, unknown>),
      returnTab: getPageReturnTab(nextState) ?? returnTab,
    };
  }
  if (nextState !== undefined && nextState !== null) return nextState;
  return { returnTab };
}

export function resolvePageViewTransitionDirection(
  fromPathname: string,
  toPathname: string,
  isBack = false,
): PageViewTransitionDirection | null {
  const from = normalizePathname(fromPathname);
  const to = normalizePathname(toPathname);
  if (from === to) return null;

  const fromIsTab = isPrimaryTabPath(from);
  const toIsTab = isPrimaryTabPath(to);

  if (fromIsTab && toIsTab) return null;
  if (toIsTab && !isBack) return null;
  return isBack ? 'back' : 'forward';
}

export function startPageViewTransition(
  direction: PageViewTransitionDirection,
  update: () => void,
): void {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return;
  }

  const root = document.documentElement;
  const transitionId = `${Date.now()}-${Math.random()}`;
  root.dataset.pageTransitionDirection = direction;
  root.dataset.pageTransitionId = transitionId;

  const clearDirection = () => {
    if (root.dataset.pageTransitionId !== transitionId) return;
    delete root.dataset.pageTransitionDirection;
    delete root.dataset.pageTransitionId;
  };

  try {
    const transition = document.startViewTransition(() => flushSync(update));
    void transition.finished.then(clearDirection, clearDirection);
  } catch {
    clearDirection();
    update();
  }
}

function hasKeyboardVisibleFocus(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.activeElement instanceof HTMLElement &&
    document.activeElement.matches(':focus-visible')
  );
}

export function usePageNavigation(): {
  navigate: NavigateFunction;
  navigateBack: (to: To, options?: NavigateOptions) => void;
} {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;

  const navigate = useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        routerNavigate(to);
        return;
      }

      const destinationPath = resolvePath(to, pathname).pathname;
      const direction = resolvePageViewTransitionDirection(pathname, destinationPath);
      const state = preservePageReturnTab(location.state, options?.state, destinationPath);
      const update = () => routerNavigate(to, { ...options, state, viewTransition: false });
      if (!direction || hasKeyboardVisibleFocus()) {
        update();
        return;
      }

      startPageViewTransition(direction, update);
    },
    [location.state, pathname, routerNavigate],
  ) as NavigateFunction;

  const navigateBack = useCallback(
    (to: To, options?: NavigateOptions) => {
      const destinationPath = resolvePath(to, pathname).pathname;
      const direction = resolvePageViewTransitionDirection(pathname, destinationPath, true);
      const state = preservePageReturnTab(location.state, options?.state, destinationPath);
      const update = () => routerNavigate(to, { ...options, state, viewTransition: false });
      if (!direction || hasKeyboardVisibleFocus()) {
        update();
        return;
      }

      startPageViewTransition(direction, update);
    },
    [location.state, pathname, routerNavigate],
  );

  return useMemo(() => ({ navigate, navigateBack }), [navigate, navigateBack]);
}

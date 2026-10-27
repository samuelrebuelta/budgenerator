import type { MouseEvent as ReactMouseEvent } from 'react';
import { Link, resolvePath, useLocation, useNavigate, type LinkProps } from 'react-router-dom';
import {
  preservePageReturnTab,
  resolvePageViewTransitionDirection,
  startPageViewTransition,
} from './page-view-transition';

interface PageLinkProps extends LinkProps {
  back?: boolean;
}

function isOrdinaryNavigationClick(
  event: ReactMouseEvent<HTMLAnchorElement>,
  target: string | undefined,
  download: LinkProps['download'],
  reloadDocument: boolean | undefined,
): boolean {
  return (
    event.detail !== 0 &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!target || target === '_self') &&
    !download &&
    !reloadDocument
  );
}

export function PageLink({ back = false, onClick, to, ...props }: PageLinkProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const destinationPath = resolvePath(to, pathname).pathname;
  const state = preservePageReturnTab(location.state, props.state, destinationPath);

  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      !isOrdinaryNavigationClick(event, props.target, props.download, props.reloadDocument)
    )
      return;

    const direction = resolvePageViewTransitionDirection(pathname, destinationPath, back);
    if (!direction) return;

    event.preventDefault();
    startPageViewTransition(direction, () =>
      navigate(to, {
        replace: props.replace,
        state,
        relative: props.relative,
        preventScrollReset: props.preventScrollReset,
        viewTransition: false,
      }),
    );
  };

  return <Link {...props} to={to} state={state} onClick={handleClick} viewTransition={false} />;
}

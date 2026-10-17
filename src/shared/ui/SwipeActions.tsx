import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Ellipsis, Trash2, Check } from 'lucide-react';
import { swipeDirection, type SwipeDirection } from './swipeGesture';
export type { SwipeDirection } from './swipeGesture';
export interface SwipeAction {
  id: 'delete' | 'default';
  label: string;
  onAction: () => void;
  disabled?: boolean;
}
interface SwipeActionsProps {
  label: string;
  children: ReactNode;
  actions: SwipeAction[];
  openDirection: SwipeDirection;
  onReveal: (direction: SwipeDirection) => void;
  disabled?: boolean;
}
export function SwipeActions({
  label,
  children,
  actions,
  openDirection,
  onReveal,
  disabled,
}: SwipeActionsProps) {
  const id = useId();
  const row = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    axis: 'x' | 'y' | null;
    pointerId: number;
  } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    if (!openDirection) return;
    const close = (event: PointerEvent) => {
      if (!row.current?.contains(event.target as Node)) onReveal(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openDirection, onReveal]);
  const selectedAction = openDirection
    ? actions.find((action) => action.id === (openDirection === 'left' ? 'delete' : 'default'))
    : undefined;
  const run = (action: SwipeAction) => {
    menu.current?.hidePopover();
    onReveal(null);
    action.onAction();
  };
  return (
    <div
      ref={row}
      className="swipe-row"
      data-swipe-row
      onPointerDown={(event) => {
        suppressClick.current = false;
        if (
          disabled ||
          !['touch', 'pen'].includes(event.pointerType) ||
          (event.target as HTMLElement).closest('button, [popover]')
        )
          return;
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          axis: null,
          pointerId: event.pointerId,
        };
      }}
      onPointerMove={(event) => {
        const start = gesture.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const dx = event.clientX - start.x,
          dy = event.clientY - start.y;
        if (!start.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
          start.axis = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
          if (start.axis === 'x') {
            menu.current?.hidePopover();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              /* Synthetic events do not have a native active pointer. */
            }
          }
        }
      }}
      onPointerUp={(event) => {
        const start = gesture.current;
        gesture.current = null;
        if (!start || start.pointerId !== event.pointerId || start.axis === 'y') return;
        const direction = swipeDirection(
          event.clientX - start.x,
          event.clientY - start.y,
          actions.some((action) => action.id === 'default' && !action.disabled),
        );
        if (direction) {
          suppressClick.current = true;
          onReveal(direction);
        }
      }}
      onPointerCancel={() => {
        gesture.current = null;
        suppressClick.current = false;
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onReveal(null);
      }}
    >
      {selectedAction && (
        <button
          type="button"
          data-swipe-action
          className={`swipe-action ${selectedAction.id}`}
          disabled={disabled || selectedAction.disabled}
          onClick={() => run(selectedAction)}
        >
          {selectedAction.id === 'delete' ? <Trash2 size={18} /> : <Check size={18} />}
          <span>{selectedAction.label}</span>
        </button>
      )}
      <div className={`swipe-content ${openDirection ? `reveal-${openDirection}` : ''}`}>
        <div className="swipe-item">{children}</div>
        <button
          type="button"
          className="row-actions-trigger"
          disabled={disabled}
          popoverTarget={id}
          aria-label={`Acciones de ${label}`}
          aria-haspopup="dialog"
          onClick={(event) => {
            onReveal(null);
            const rect = event.currentTarget.getBoundingClientRect();
            if (menu.current) {
              menu.current.style.left = `${Math.max(12, Math.min(rect.right - 232, window.innerWidth - 244))}px`;
              menu.current.style.top = `${Math.max(12, Math.min(rect.bottom + 4, window.innerHeight - 146))}px`;
            }
          }}
        >
          <Ellipsis size={20} aria-hidden="true" />
        </button>
      </div>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className="row-actions-menu"
        role="dialog"
        aria-label={`Acciones de ${label}`}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={disabled || action.disabled}
            className={action.id === 'delete' ? 'row-action-delete' : ''}
            onClick={() => run(action)}
          >
            {action.id === 'delete' ? <Trash2 size={17} /> : <Check size={17} />}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

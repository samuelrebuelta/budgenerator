import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
type AlertTone = Exclude<Tone, 'neutral'>;

const toneStyles: Record<AlertTone, string> = {
  info: 'border-info-line bg-info-surface text-info-ink',
  success: 'border-success-line bg-success-surface text-success-ink',
  warning: 'border-warning-line bg-warning-surface text-warning-ink',
  danger: 'border-danger-line bg-danger-surface text-danger-ink',
};

const toneIcons: Record<AlertTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons or links shown below the message. */
  action?: ReactNode;
  onDismiss?: () => void;
  /** Defaults to `alert` for danger/warning and `status` for info/success. */
  role?: 'alert' | 'status' | 'none';
  /** Hides the leading icon. */
  plain?: boolean;
  className?: string;
}

/** Inline message for errors, warnings and confirmations next to the related content. */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  role,
  plain = false,
  className,
}: AlertProps) {
  const Icon = toneIcons[tone];
  const resolvedRole = role ?? (tone === 'danger' || tone === 'warning' ? 'alert' : 'status');
  return (
    <div
      role={resolvedRole === 'none' ? undefined : resolvedRole}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', toneStyles[tone], className)}
    >
      {!plain && <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('leading-6', title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="-my-1 -mr-2 grid size-9 min-h-9 shrink-0 place-items-center rounded-full hover:bg-black/5"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

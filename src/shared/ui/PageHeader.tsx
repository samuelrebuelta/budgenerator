import { useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { PageHeaderAccessoryContext } from './PageHeaderAccessoryContext';

export function BackButton({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="back-button" aria-label={label}>
      <ChevronLeft size={21} aria-hidden="true" />
    </Link>
  );
}

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}
export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = 'Volver a la página anterior',
}: PageHeaderProps) {
  const accessory = useContext(PageHeaderAccessoryContext);

  return (
    <header
      className="page-heading unified-page-header no-print"
      data-page-header
      data-has-back={!!backTo}
    >
      {backTo && <BackButton to={backTo} label={backLabel} />}
      <div className="page-heading-identity">
        <div className="page-heading-copy">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {backTo && accessory && <div className="page-heading-menu-action">{accessory}</div>}
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
export function PageHeaderSkeleton({
  backTo,
  backLabel = 'Volver a la página anterior',
}: {
  backTo?: string;
  backLabel?: string;
} = {}) {
  const accessory = useContext(PageHeaderAccessoryContext);

  return (
    <div
      className={`page-heading header-skeleton${backTo ? ' unified-page-header' : ''}`}
      data-has-back={!!backTo}
    >
      {backTo && <BackButton to={backTo} label={backLabel} />}
      <div className="page-heading-skeleton-copy" aria-hidden="true">
        <Skeleton className="mb-3 h-9 w-60 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {backTo && accessory && <div className="page-heading-menu-action">{accessory}</div>}
    </div>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
export function PageLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('page-container', className)}>{children}</div>;
}

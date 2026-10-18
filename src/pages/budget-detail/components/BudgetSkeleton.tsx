import { Card, Skeleton, PageHeaderSkeleton } from '@/shared/ui';

export function BudgetSkeleton() {
  return (
    <div className="page-container">
      <div className="document-skeleton">
        <PageHeaderSkeleton backTo="/budgets" backLabel="Volver a presupuestos" />
        <Card className="p-4 sm:p-8 space-y-6">
          <Skeleton className="h-7 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    </div>
  );
}

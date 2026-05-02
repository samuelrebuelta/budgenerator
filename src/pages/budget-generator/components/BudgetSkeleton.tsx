import { Skeleton } from '@/shared/ui';

export function BudgetSkeleton() {
  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-4 sm:py-8 sm:px-6">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 p-4 sm:p-8 space-y-6">
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
        </div>
      </div>
    </div>
  );
}

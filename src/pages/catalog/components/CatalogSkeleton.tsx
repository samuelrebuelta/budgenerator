import { Skeleton, SkeletonList } from '@/shared/ui';

export function CatalogSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <SkeletonList count={3} className="space-y-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div className="p-3 sm:p-0 space-y-2 sm:space-y-0">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </SkeletonList>
    </div>
  );
}

import { Skeleton, SkeletonList } from '@/shared/ui';

export function BudgetListSkeleton() {
  return (
    <SkeletonList count={4} className="space-y-3">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
    </SkeletonList>
  );
}

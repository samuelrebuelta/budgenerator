import { Skeleton } from '@/shared/ui';

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8 sm:px-6">
        <Skeleton className="h-4 w-16 mb-4" />
        <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 p-4 sm:p-8 space-y-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-20 w-20 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

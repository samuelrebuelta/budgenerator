import { Card, Skeleton, PageHeaderSkeleton } from '@/shared/ui';

export function ProfileSkeleton() {
  return (
    <div className="page-container">
      <div className="document-skeleton">
        <PageHeaderSkeleton backTo="/projects" backLabel="Volver a proyectos" />
        <Card className="p-4 sm:p-8 space-y-6">
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
        </Card>
      </div>
    </div>
  );
}

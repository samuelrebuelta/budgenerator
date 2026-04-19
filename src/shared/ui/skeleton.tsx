import { cn } from '@/shared/lib';

interface SkeletonProps {
  className?: string;
}

/** A single animated placeholder block. Compose these to build page skeletons. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className,
      )}
    />
  );
}

/** Repeats children `count` times inside an optional wrapper className. */
export function SkeletonList({
  count,
  children,
  className,
}: {
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{children}</div>
      ))}
    </div>
  );
}

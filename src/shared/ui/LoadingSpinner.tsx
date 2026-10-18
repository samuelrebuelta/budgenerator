import { LoaderCircle } from 'lucide-react';
import { cn } from '@/shared/lib';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export function LoadingSpinner({ size = 16, className }: LoadingSpinnerProps) {
  return (
    <LoaderCircle
      size={size}
      aria-hidden="true"
      className={cn('shrink-0 animate-spin motion-reduce:animate-none', className)}
    />
  );
}

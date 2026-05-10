import { ArrowLeft } from 'lucide-react';
import { cn } from '@/shared/lib';

interface PageLayoutProps {
  children: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
  className?: string;
}

const maxWidthClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export function PageLayout({
  children,
  onBack,
  backLabel,
  maxWidth = '4xl',
  className,
}: PageLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-white sm:bg-gray-100', className)}>
      <div className={cn('mx-auto px-4 py-4 sm:py-8 sm:px-6', maxWidthClass[maxWidth])}>
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

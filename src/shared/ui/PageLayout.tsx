import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib';
import { t } from '@/shared/i18n';

interface PageLayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
  className?: string;
}

export function PageLayout({ children, showBack = true, className }: PageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className={cn('min-h-screen bg-white sm:bg-gray-100', className)}>
      <div className="mx-auto px-4 py-4 sm:py-8 sm:px-6 max-w-4xl">
        {showBack && (
          <button
            onClick={() => navigate('/budgets')}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
          >
            <ArrowLeft size={14} />
            {t('common.back')}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

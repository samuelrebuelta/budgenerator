import { useRouteError, useNavigate } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  const message =
    error instanceof Error
      ? error.message
      : t('error.unknownError');

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <AlertTriangle size={48} className="mx-auto text-orange-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">{t('error.title')}</h1>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RotateCcw size={16} />
            {t('error.reload')}
          </Button>
          <Button onClick={() => navigate('/', { replace: true })}>
            <Home size={16} />
            {t('error.goHome')}
          </Button>
        </div>
      </div>
    </div>
  );
}

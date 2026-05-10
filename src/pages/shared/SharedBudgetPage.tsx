import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSharedBudget } from '@/entities/budget/api/firestore';
import type { SharedBudget } from '@/shared/types';
import { SharedBudgetView } from './components/SharedBudgetView';
import { t } from '@/shared/i18n';

export function SharedBudgetPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchSharedBudget(token)
      .then((result) => {
        if (result) {
          setData(result);
          const name = result.company?.name;
          if (name) document.title = `Presupuesto de ${name}`;
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-pulse text-gray-400">{t('common.loading')}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">{t('share.notFound')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('share.notFoundHint')}</p>
        </div>
      </div>
    );
  }

  return <SharedBudgetView budget={data.budget} company={data.company} />;
}

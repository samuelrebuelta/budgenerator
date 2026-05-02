import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { useBudgetStore, setBudgetAuthGetter } from '@/entities/budget';
import { useTariffStore, setTariffAuthGetter } from '@/entities/tariff';
import { useProfileStore, setProfileAuthGetter } from '@/entities/profile';
import { useTemplateStore, setTemplateAuthGetter } from '@/entities/template';

export function AuthGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  // Wire up auth getter for stores and load data when user logs in
  useEffect(() => {
    if (!user) return;
    setBudgetAuthGetter(() => user.uid);
    setTariffAuthGetter(() => user.uid);
    setProfileAuthGetter(() => user.uid);
    setTemplateAuthGetter(() => user.uid);
    useBudgetStore.getState().loadBudgets(user.uid);
    useTariffStore.getState().loadTariffs(user.uid);
    useProfileStore.getState().loadProfile(user.uid, user.email ?? '');
    useTemplateStore.getState().loadTemplates(user.uid);
  }, [user]);

  if (loading) {
    return <div className="min-h-screen bg-white sm:bg-gray-100" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

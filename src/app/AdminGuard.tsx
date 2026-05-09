import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { useUserStore } from '@/entities/user';

export function AdminGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const init = useAuthStore((s) => s.init);
  const userData = useUserStore((s) => s.userData);
  const userLoaded = useUserStore((s) => s.loaded);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  // Load user data if authenticated but not yet loaded
  useEffect(() => {
    if (user && !userLoaded) {
      useUserStore.getState().loadUserData(user.uid, user.email ?? '');
    }
  }, [user, userLoaded]);

  if (loading || (user && !userLoaded)) {
    return <div className="min-h-screen bg-white sm:bg-gray-100" />;
  }

  if (!user || !userData?.accountData.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

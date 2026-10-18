import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { useSessionStore, loadSession } from './session';
import { AppShell } from './AppShell';
export function AuthGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();
  const session = useSessionStore();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (session.uid !== user.uid || session.status !== 'ready')
    return <LoadingScreen error={session.error} onRetry={() => loadSession(user, true)} />;
  return <AppShell>{children}</AppShell>;
}

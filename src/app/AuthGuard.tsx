import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { useSessionStore, loadSession } from './session';
import { AppShell } from './AppShell';
import { useNetworkStore } from '@/shared/model/network';

function OfflineRestoreStatus() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <p className="text-sm text-ink-muted" role="status" aria-live="polite">
        Abriendo la última copia guardada…
      </p>
    </main>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();
  const session = useSessionStore();
  const online = useNetworkStore((state) => state.online);
  if (loading) return online ? <LoadingScreen /> : <OfflineRestoreStatus />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (session.uid !== user.uid || session.status !== 'ready') {
    if (!online) return <OfflineRestoreStatus />;
    return <LoadingScreen error={session.error} onRetry={() => loadSession(user, true)} />;
  }
  return <AppShell>{children}</AppShell>;
}

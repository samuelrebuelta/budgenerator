import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { hasPendingWrites, flushWrites } from '@/shared/model/sync';
import { ToastHost } from '@/shared/ui/ToastHost';
import { router } from './router';
import { PwaStatus } from './PwaStatus';
import { loadedSessionModule, loadSessionModule } from './sessionModule';
export function App() {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  useEffect(() => init(), [init]);
  useEffect(() => {
    let current = true;
    if (user)
      void loadSessionModule().then((session) => {
        if (current) void session.loadSession(user);
      });
    else loadedSessionModule()?.resetSession(null);
    return () => {
      current = false;
    };
  }, [user]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasPendingWrites() || loadedSessionModule()?.hasDirtyBudgetDraft()) {
        event.preventDefault();
        void flushWrites().catch(() => {});
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return (
    <>
      <RouterProvider router={router} />
      <PwaStatus />
      <ToastHost />
    </>
  );
}

import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { loadSession, resetSession } from './session';
import { hasPendingWrites, flushWrites } from '@/shared/model/sync';
import { useBudgetStore } from '@/entities/budget';
import { router } from './router';
import { PwaStatus } from './PwaStatus';
export function App() {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  useEffect(() => init(), [init]);
  useEffect(() => {
    if (user) void loadSession(user);
    else resetSession(null);
  }, [user]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasPendingWrites() || useBudgetStore.getState().draftDirty) {
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
    </>
  );
}

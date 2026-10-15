import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStore } from '@/entities/user';
import { AuthGuard } from './AuthGuard';
function AdminContent({ children }: { children: ReactNode }) {
  const userData = useUserStore((s) => s.userData);
  return userData?.accountData.isAdmin ? children : <Navigate to="/budgets" replace />;
}
export function AdminGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AdminContent>{children}</AdminContent>
    </AuthGuard>
  );
}

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { AuthGuard } from './AuthGuard';
function AdminContent({ children }: { children: ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  return isAdmin ? children : <Navigate to="/budgets" replace />;
}
export function AdminGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AdminContent>{children}</AdminContent>
    </AuthGuard>
  );
}

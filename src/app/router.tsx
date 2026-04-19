import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BudgetListPage } from '@/pages/budget-list';
import { BudgetPage } from '@/pages/budget';
import { CatalogPage } from '@/pages/catalog';
import { ProfilePage } from '@/pages/profile';
import { LoginPage } from '@/pages/login';
import { SharedBudgetPage } from '@/pages/shared';
import { AuthGuard } from './AuthGuard';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/shared/:token', element: <SharedBudgetPage /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <BudgetListPage />
      </AuthGuard>
    ),
  },
  {
    path: '/budget/:budgetId',
    element: (
      <AuthGuard>
        <BudgetPage />
      </AuthGuard>
    ),
  },
  {
    path: '/catalog',
    element: (
      <AuthGuard>
        <CatalogPage />
      </AuthGuard>
    ),
  },
  {
    path: '/profile',
    element: (
      <AuthGuard>
        <ProfilePage />
      </AuthGuard>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

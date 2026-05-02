import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BudgetListPage } from '@/pages/budget-list';
import { BudgetGeneratorPage } from '@/pages/budget-generator';
import { CatalogPage } from '@/pages/catalog';
import { ProfilePage } from '@/pages/profile';
import { LoginPage } from '@/pages/login';
import { BudgetViewerPage } from '@/pages/budget-viewer';
import { AuthGuard } from './AuthGuard';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/shared/:token', element: <BudgetViewerPage /> },
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
        <BudgetGeneratorPage />
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

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BudgetListPage } from '@/pages/budget-list';
import { BudgetGeneratorPage } from '@/pages/budget-generator';
import { CatalogPage } from '@/pages/catalog';
import { ProfilePage } from '@/pages/profile';
import { SettingsPage, ChangePasswordPage } from '@/pages/settings';
import { LoginPage } from '@/pages/login';
import { BudgetViewerPage } from '@/pages/budget-viewer';
import { AdminPage } from '@/pages/admin';
import { AuthGuard } from './AuthGuard';
import { AdminGuard } from './AdminGuard';
import { ErrorPage } from './ErrorPage';

const errorElement = <ErrorPage />;

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement },
  { path: '/shared/:token', element: <BudgetViewerPage />, errorElement },
  {
    path: '/',
    errorElement,
    element: (
      <AuthGuard>
        <BudgetListPage />
      </AuthGuard>
    ),
  },
  {
    path: '/budget/:budgetId',
    errorElement,
    element: (
      <AuthGuard>
        <BudgetGeneratorPage />
      </AuthGuard>
    ),
  },
  {
    path: '/catalog',
    errorElement,
    element: (
      <AuthGuard>
        <CatalogPage />
      </AuthGuard>
    ),
  },
  {
    path: '/profile',
    errorElement,
    element: (
      <AuthGuard>
        <ProfilePage />
      </AuthGuard>
    ),
  },
  {
    path: '/settings',
    errorElement,
    element: (
      <AuthGuard>
        <SettingsPage />
      </AuthGuard>
    ),
  },
  {
    path: '/settings/password',
    errorElement,
    element: (
      <AuthGuard>
        <ChangePasswordPage />
      </AuthGuard>
    ),
  },
  {
    path: '/admin',
    errorElement,
    element: (
      <AdminGuard>
        <AdminPage />
      </AdminGuard>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

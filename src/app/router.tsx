import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BudgetsPage } from '@/pages/budgets';
import { BudgetDetailPage } from '@/pages/budget-detail';
import { CatalogsPage } from '@/pages/catalogs';
import { ProfilePage } from '@/pages/profile';
import { AccountPage, ChangePasswordPage } from '@/pages/account';
import { LoginPage } from '@/pages/login';
import { BudgetViewerPage } from '@/pages/budget-viewer';
import { AdminPage } from '@/pages/admin';
import { TemplatesPage } from '@/pages/templates';
import { TemplateDetailPage } from '@/pages/template-detail';
import { AuthGuard } from './AuthGuard';
import { AdminGuard } from './AdminGuard';
import { ErrorPage } from './ErrorPage';

const errorElement = <ErrorPage />;

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement },
  { path: '/shared/:token', element: <BudgetViewerPage />, errorElement },
  { path: '/', element: <Navigate to="/budgets" replace /> },
  {
    path: '/budgets',
    errorElement,
    element: (
      <AuthGuard>
        <BudgetsPage />
      </AuthGuard>
    ),
  },
  {
    path: '/budget/:budgetId',
    errorElement,
    element: (
      <AuthGuard>
        <BudgetDetailPage />
      </AuthGuard>
    ),
  },
  {
    path: '/catalogs',
    errorElement,
    element: (
      <AuthGuard>
        <CatalogsPage />
      </AuthGuard>
    ),
  },
  {
    path: '/templates',
    errorElement,
    element: (
      <AuthGuard>
        <TemplatesPage />
      </AuthGuard>
    ),
  },
  {
    path: '/templates/:templateId',
    errorElement,
    element: (
      <AuthGuard>
        <TemplateDetailPage />
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
    path: '/account',
    errorElement,
    element: (
      <AuthGuard>
        <AccountPage />
      </AuthGuard>
    ),
  },
  {
    path: '/account/password',
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

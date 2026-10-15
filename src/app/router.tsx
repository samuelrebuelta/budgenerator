import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthGuard } from './AuthGuard';
import { AdminGuard } from './AdminGuard';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { ErrorPage } from './ErrorPage';
const errorElement = <ErrorPage />;
const hydrateFallbackElement = <LoadingScreen />;
export const router = createBrowserRouter([
  {
    path: '/login',
    errorElement,
    hydrateFallbackElement,
    lazy: async () => ({ Component: (await import('@/pages/login')).LoginPage }),
  },
  {
    path: '/shared/:token',
    errorElement,
    hydrateFallbackElement,
    lazy: async () => ({ Component: (await import('@/pages/budget-viewer')).BudgetViewerPage }),
  },
  { path: '/', element: <Navigate to="/budgets" replace /> },
  {
    element: (
      <AuthGuard>
        <Outlet />
      </AuthGuard>
    ),
    errorElement,
    hydrateFallbackElement,
    children: [
      {
        path: '/budgets',
        lazy: async () => ({ Component: (await import('@/pages/budgets')).BudgetsPage }),
      },
      {
        path: '/budget/:budgetId',
        lazy: async () => ({ Component: (await import('@/pages/budget-detail')).BudgetDetailPage }),
      },
      {
        path: '/catalogs',
        lazy: async () => ({ Component: (await import('@/pages/catalogs')).CatalogsPage }),
      },
      {
        path: '/catalogs/:catalogId',
        lazy: async () => ({
          Component: (await import('@/pages/catalogs/CatalogDetailPage')).CatalogDetailPage,
        }),
      },
      {
        path: '/templates',
        lazy: async () => ({ Component: (await import('@/pages/templates')).TemplatesPage }),
      },
      {
        path: '/templates/:templateId',
        lazy: async () => ({
          Component: (await import('@/pages/template-detail')).TemplateDetailPage,
        }),
      },
      {
        path: '/profile',
        lazy: async () => ({ Component: (await import('@/pages/profile')).ProfilePage }),
      },
      {
        path: '/account',
        lazy: async () => ({
          Component: (await import('@/pages/account/AccountPage')).AccountPage,
        }),
      },
      {
        path: '/account/password',
        lazy: async () => ({
          Component: (await import('@/pages/account/ChangePasswordPage')).ChangePasswordPage,
        }),
      },
    ],
  },
  {
    element: (
      <AdminGuard>
        <Outlet />
      </AdminGuard>
    ),
    errorElement,
    hydrateFallbackElement,
    children: [
      {
        path: '/admin',
        lazy: async () => ({ Component: (await import('@/pages/admin')).AdminPage }),
      },
    ],
  },
  { path: '*', element: <Navigate to="/budgets" replace /> },
]);

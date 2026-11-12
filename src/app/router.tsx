import { createBrowserRouter, Navigate } from 'react-router-dom';
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
  {
    path: '/solicitar-presupuesto/:token',
    errorElement,
    hydrateFallbackElement,
    lazy: async () => ({ Component: (await import('@/pages/public-quote')).QuoteEstimatorPage }),
  },
  { path: '/', element: <Navigate to="/projects" replace /> },
  {
    lazy: async () => ({ Component: (await import('./ProtectedLayout')).ProtectedLayout }),
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
        path: '/projects',
        lazy: async () => ({ Component: (await import('@/pages/projects')).ProjectsPage }),
      },
      {
        path: '/projects/:projectId',
        lazy: async () => ({
          Component: (await import('@/pages/project-detail')).ProjectDetailPage,
        }),
      },
      {
        // Layout shared by the team routes: roster loading and the calendar view state.
        path: '/team',
        lazy: async () => ({ Component: (await import('@/pages/workforce')).TeamLayout }),
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import('@/pages/workforce')).TeamSchedulePage }),
          },
          {
            path: 'manage',
            lazy: async () => ({ Component: (await import('@/pages/workforce')).TeamManagePage }),
          },
          {
            path: 'jobs/new',
            lazy: async () => ({ Component: (await import('@/pages/workforce')).NewTeamJobPage }),
          },
          {
            path: 'new-work',
            lazy: async () => ({ Component: (await import('@/pages/workforce')).NewTeamJobPage }),
          },
          { path: '*', element: <Navigate to="/team" replace /> },
        ],
      },
      {
        path: '/catalog',
        lazy: async () => ({ Component: (await import('@/pages/catalogs')).CatalogsPage }),
      },
      { path: '/catalogs', element: <Navigate to="/catalog" replace /> },
      { path: '/catalogs/:catalogId', element: <Navigate to="/catalog" replace /> },
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
        path: '/help',
        lazy: async () => ({ Component: (await import('@/pages/help/HelpPage')).HelpPage }),
      },
      {
        path: '/profile',
        lazy: async () => ({ Component: (await import('@/pages/profile')).ProfilePage }),
      },
      {
        path: '/estimator',
        lazy: async () => ({
          Component: (await import('@/pages/quote-estimator')).QuoteEstimatorSettingsPage,
        }),
      },
      { path: '/profile/estimador-publico', element: <Navigate to="/estimator" replace /> },
      {
        path: '/profile/solicitudes',
        lazy: async () => ({ Component: (await import('@/pages/leads')).LeadsPage }),
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
    lazy: async () => ({ Component: (await import('./ProtectedLayout')).AdminLayout }),
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

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BudgetListPage } from '@/pages/budget-list';
import { BudgetPage } from '@/pages/budget';
import { CatalogPage } from '@/pages/catalog';

export const router = createBrowserRouter([
  { path: '/', element: <BudgetListPage /> },
  { path: '/budget/:budgetId', element: <BudgetPage /> },
  { path: '/catalog', element: <CatalogPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

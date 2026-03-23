import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import HomeLayout from '@/components/layout/HomeLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import PlaceholderPage from '@/components/PlaceholderPage';
import PropertiesPage from '@/pages/properties/PropertiesPage';
import DiscoverPage from '@/pages/DiscoverPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ObjectTypeListPage from '@/pages/object-types/ObjectTypeListPage';
import ObjectTypeDetailLayout from '@/pages/object-types/ObjectTypeDetailLayout';
import ObjectTypeOverviewPage from '@/pages/object-types/ObjectTypeOverviewPage';
import ObjectTypePropertiesPage from '@/pages/object-types/ObjectTypePropertiesPage';
import ObjectTypeDatasourcesPage from '@/pages/object-types/ObjectTypeDatasourcesPage';
import ObjectTypeInstancesPage from '@/pages/object-types/ObjectTypeInstancesPage';
import LinkTypeListPage from '@/pages/link-types/LinkTypeListPage';
import LinkTypeDetailPage from '@/pages/link-types/LinkTypeDetailPage';
import DataConnectionPage from '@/pages/data-connection/DataConnectionPage';
import HistoryPage from '@/pages/history/HistoryPage';
import ObjectTypeHistoryPage from '@/pages/object-types/ObjectTypeHistoryPage';
export const routeConfig: RouteObject[] = [
  {
    path: '/demo/canvas',
    lazy: () => import('@/pages/demo/DemoCanvasPage'),
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        element: <HomeLayout />,
        children: [
          { index: true, element: <DiscoverPage /> },
          { path: 'object-types', element: <ObjectTypeListPage /> },
          { path: 'link-types', element: <LinkTypeListPage /> },
          { path: 'properties', element: <PropertiesPage /> },
          { path: 'action-types', element: <PlaceholderPage title="Action Types" comingSoon /> },
          { path: 'data-connection', element: <DataConnectionPage /> },
          { path: 'history', element: <HistoryPage /> },
        ],
      },
      {
        path: 'object-types/:rid',
        element: <ObjectTypeDetailLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <ObjectTypeOverviewPage /> },
          { path: 'properties', element: <ObjectTypePropertiesPage /> },
          { path: 'datasources', element: <ObjectTypeDatasourcesPage /> },
          { path: 'instances', element: <ObjectTypeInstancesPage /> },
          { path: 'history', element: <ObjectTypeHistoryPage /> },
        ],
      },
      { path: 'link-types/:rid', element: <LinkTypeDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);

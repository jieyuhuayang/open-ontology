import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { Spin } from 'antd';
import AppShell from '@/components/layout/AppShell';
import HomeLayout from '@/components/layout/HomeLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import PlaceholderPage from '@/components/PlaceholderPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Lazy-loaded business pages
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage'));
const ObjectTypeListPage = lazy(() => import('@/pages/object-types/ObjectTypeListPage'));
const ObjectTypeDetailLayout = lazy(() => import('@/pages/object-types/ObjectTypeDetailLayout'));
const ObjectTypeOverviewPage = lazy(() => import('@/pages/object-types/ObjectTypeOverviewPage'));
const ObjectTypePropertiesPage = lazy(() => import('@/pages/object-types/ObjectTypePropertiesPage'));
const ObjectTypeDatasourcesPage = lazy(() => import('@/pages/object-types/ObjectTypeDatasourcesPage'));
const ObjectTypeInstancesPage = lazy(() => import('@/pages/object-types/ObjectTypeInstancesPage'));
const ObjectTypeHistoryPage = lazy(() => import('@/pages/object-types/ObjectTypeHistoryPage'));
const LinkTypeListPage = lazy(() => import('@/pages/link-types/LinkTypeListPage'));
const LinkTypeDetailPage = lazy(() => import('@/pages/link-types/LinkTypeDetailPage'));
const PropertiesPage = lazy(() => import('@/pages/properties/PropertiesPage'));
const DataConnectionPage = lazy(() => import('@/pages/data-connection/DataConnectionPage'));
const HistoryPage = lazy(() => import('@/pages/history/HistoryPage'));

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spin style={{ display: 'flex', justifyContent: 'center', marginTop: 120 }} />}>
      {children}
    </Suspense>
  );
}

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
          { index: true, element: <PageSuspense><DiscoverPage /></PageSuspense> },
          { path: 'object-types', element: <PageSuspense><ObjectTypeListPage /></PageSuspense> },
          { path: 'link-types', element: <PageSuspense><LinkTypeListPage /></PageSuspense> },
          { path: 'properties', element: <PageSuspense><PropertiesPage /></PageSuspense> },
          { path: 'action-types', element: <PlaceholderPage title="Action Types" comingSoon /> },
          { path: 'data-connection', element: <PageSuspense><DataConnectionPage /></PageSuspense> },
          { path: 'history', element: <PageSuspense><HistoryPage /></PageSuspense> },
        ],
      },
      {
        path: 'object-types/:rid',
        element: <PageSuspense><ObjectTypeDetailLayout /></PageSuspense>,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <PageSuspense><ObjectTypeOverviewPage /></PageSuspense> },
          { path: 'properties', element: <PageSuspense><ObjectTypePropertiesPage /></PageSuspense> },
          { path: 'datasources', element: <PageSuspense><ObjectTypeDatasourcesPage /></PageSuspense> },
          { path: 'instances', element: <PageSuspense><ObjectTypeInstancesPage /></PageSuspense> },
          { path: 'history', element: <PageSuspense><ObjectTypeHistoryPage /></PageSuspense> },
        ],
      },
      { path: 'link-types/:rid', element: <PageSuspense><LinkTypeDetailPage /></PageSuspense> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);

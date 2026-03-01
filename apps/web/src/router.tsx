import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import HomeLayout from '@/components/layout/HomeLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import PlaceholderPage from '@/components/PlaceholderPage';
import DiscoverPage from '@/pages/DiscoverPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ObjectTypeListPage from '@/pages/object-types/ObjectTypeListPage';
import ObjectTypeDetailLayout from '@/pages/object-types/ObjectTypeDetailLayout';
import ObjectTypeOverviewPage from '@/pages/object-types/ObjectTypeOverviewPage';
import LinkTypeListPage from '@/pages/link-types/LinkTypeListPage';
import LinkTypeDetailLayout from '@/pages/link-types/LinkTypeDetailLayout';

export const routeConfig: RouteObject[] = [
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
          { path: 'link-types/new', element: <PlaceholderPage title="Create Link Type" /> },
          { path: 'properties', element: <PlaceholderPage title="Properties" comingSoon /> },
          { path: 'action-types', element: <PlaceholderPage title="Action Types" comingSoon /> },
        ],
      },
      {
        path: 'object-types/:rid',
        element: <ObjectTypeDetailLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <ObjectTypeOverviewPage /> },
          { path: 'properties', element: <PlaceholderPage title="Object Type Properties" /> },
          { path: 'datasources', element: <PlaceholderPage title="Object Type Datasources" /> },
        ],
      },
      {
        path: 'link-types/:rid',
        element: <LinkTypeDetailLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <PlaceholderPage title="Link Type Overview" /> },
          { path: 'datasources', element: <PlaceholderPage title="Link Type Datasources" /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);

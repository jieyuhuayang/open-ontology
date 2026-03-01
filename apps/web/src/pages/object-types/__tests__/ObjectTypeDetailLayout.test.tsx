import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import ObjectTypeDetailLayout from '@/pages/object-types/ObjectTypeDetailLayout';

const mockObjectType = {
  rid: 'ri.ontology.object-type.abc123',
  id: 'test-object',
  apiName: 'TestObject',
  displayName: 'Test Object',
  description: 'A test object type',
  icon: { name: 'AppstoreOutlined', color: '#1677ff' },
  status: 'experimental' as const,
  visibility: 'normal' as const,
  changeState: 'created' as const,
  projectRid: 'ri.ontology.project.p1',
  ontologyRid: 'ri.ontology.ontology.o1',
  createdAt: '2024-01-01T00:00:00Z',
  createdBy: 'user1',
  lastModifiedAt: '2024-01-01T00:00:00Z',
  lastModifiedBy: 'user1',
};

vi.mock('@/api/object-types', () => ({
  useObjectType: () => ({
    data: mockObjectType,
    isLoading: false,
  }),
  useDeleteObjectType: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('ObjectTypeDetailLayout', () => {
  function renderWithRouter(path = '/object-types/test-rid/overview') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter(
      [
        {
          path: '/object-types/:rid',
          element: <ObjectTypeDetailLayout />,
          children: [
            { path: 'overview', element: <div>Overview Content</div> },
            { path: 'properties', element: <div>Properties Content</div> },
            { path: 'datasources', element: <div>Datasources Content</div> },
          ],
        },
      ],
      { initialEntries: [path] },
    );
    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  it('renders aside and main elements', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(document.querySelector('aside')).toBeInTheDocument();
      expect(document.querySelector('main')).toBeInTheDocument();
    });
  });

  it('shows Overview, Properties, and Datasources nav items', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Properties')).toBeInTheDocument();
      expect(screen.getByText('Datasources')).toBeInTheDocument();
    });
  });

  it('renders outlet content', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('Overview Content')).toBeInTheDocument();
    });
  });

  it('shows back home link', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText(/back home/i)).toBeInTheDocument();
    });
  });

  it('shows resource name from API data', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('Test Object')).toBeInTheDocument();
    });
  });

  it('shows both status badge and change state badge', async () => {
    renderWithRouter();
    await waitFor(() => {
      // StatusBadge renders "Experimental" (status=experimental)
      expect(screen.getByText('Experimental')).toBeInTheDocument();
      // ChangeStateBadge renders "New" (changeState=created)
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });
});

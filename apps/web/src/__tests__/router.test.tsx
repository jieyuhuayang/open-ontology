import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { routeConfig } from '@/router';

vi.mock('@/api/object-types', () => ({
  useObjectTypes: () => ({
    data: { items: [], total: 0, page: 1, pageSize: 20 },
    isLoading: false,
  }),
  useObjectType: () => ({
    data: null,
    isLoading: true,
  }),
  useCreateObjectType: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateObjectType: () => ({ mutate: vi.fn() }),
  useDeleteObjectType: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/api/link-types', () => ({
  useLinkTypes: () => ({
    data: { items: [], total: 0, page: 1, pageSize: 20 },
    isLoading: false,
  }),
  useLinkType: () => ({ data: null }),
  useCreateLinkType: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateLinkType: () => ({ mutate: vi.fn() }),
  useDeleteLinkType: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

let testQueryClient: QueryClient;

beforeEach(() => {
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

function renderRoute(path: string) {
  const router = createMemoryRouter(routeConfig, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={testQueryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Router', () => {
  it('/ renders DiscoverPage', async () => {
    renderRoute('/');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /recently viewed object types/i })).toBeInTheDocument();
    });
  });

  it('/object-types renders ObjectTypeListPage', async () => {
    renderRoute('/object-types');
    await waitFor(() => {
      expect(screen.getByText('Object Types', { selector: 'h4' })).toBeInTheDocument();
    });
  });

  it('/link-types renders LinkTypeListPage', async () => {
    renderRoute('/link-types');
    await waitFor(() => {
      expect(screen.getByText('Link Types', { selector: 'h4' })).toBeInTheDocument();
    });
  });

  it('/properties renders Coming Soon placeholder', async () => {
    renderRoute('/properties');
    await waitFor(() => {
      expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    });
  });

  it('/action-types renders Coming Soon placeholder', async () => {
    renderRoute('/action-types');
    await waitFor(() => {
      expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    });
  });

  it('/link-types/:rid redirects to overview', async () => {
    renderRoute('/link-types/test-rid');
    await waitFor(() => {
      expect(screen.getByText('Link Type Overview')).toBeInTheDocument();
    });
  });

  it('/random-path renders 404 page', async () => {
    renderRoute('/random-path');
    await waitFor(() => {
      expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    });
  });
});

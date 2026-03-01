import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/queryClient';
import { routeConfig } from '@/router';

function renderRoute(path: string) {
  const router = createMemoryRouter(routeConfig, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
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
      // PlaceholderPage renders inside an AntD Result component
      expect(screen.getByText('Object Types', { selector: '.ant-result-title' })).toBeInTheDocument();
    });
  });

  it('/object-types/new renders create placeholder', async () => {
    renderRoute('/object-types/new');
    await waitFor(() => {
      expect(screen.getByText('Create Object Type')).toBeInTheDocument();
    });
  });

  it('/link-types renders LinkTypeListPage', async () => {
    renderRoute('/link-types');
    await waitFor(() => {
      expect(screen.getByText('Link Types', { selector: '.ant-result-title' })).toBeInTheDocument();
    });
  });

  it('/link-types/new renders create placeholder', async () => {
    renderRoute('/link-types/new');
    await waitFor(() => {
      expect(screen.getByText('Create Link Type')).toBeInTheDocument();
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

  it('/object-types/:rid redirects to overview', async () => {
    renderRoute('/object-types/test-rid');
    await waitFor(() => {
      expect(screen.getByText('Object Type Overview')).toBeInTheDocument();
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

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import HomeLayout from '@/components/layout/HomeLayout';

vi.mock('@/pages/object-types/components/CreateObjectTypeWizard', () => ({
  default: () => null,
}));

vi.mock('@/pages/link-types/components/CreateLinkTypeWizard', () => ({
  default: () => null,
}));

vi.mock('@/api/object-types', () => ({
  useObjectTypes: () => ({ data: { items: [], total: 0 }, isLoading: false }),
}));

vi.mock('@/api/link-types', () => ({
  useLinkTypes: () => ({ data: { items: [], total: 0 }, isLoading: false }),
}));

vi.mock('@/api/search', () => ({
  useSearch: () => ({ data: null, isLoading: false, error: null }),
}));

vi.mock('@/api/working-state', () => ({
  useWorkingState: () => ({ data: null, isLoading: false, error: null }),
  useDiscardAll: () => ({ mutateAsync: vi.fn(), isPending: false }),
  DEFAULT_ONTOLOGY_RID: 'ri.ontology.ontology.default',
}));

describe('HomeLayout', () => {
  function renderWithRouter() {
    const router = createMemoryRouter([
      {
        path: '/',
        element: <AppShell />,
        children: [
          {
            element: <HomeLayout />,
            children: [{ index: true, element: <div>Page Content</div> }],
          },
        ],
      },
    ]);
    return render(<RouterProvider router={router} />);
  }

  it('renders aside element', () => {
    renderWithRouter();
    expect(document.querySelector('aside')).toBeInTheDocument();
  });

  it('renders main element', () => {
    renderWithRouter();
    expect(document.querySelector('main')).toBeInTheDocument();
  });

  it('renders child content via Outlet', () => {
    renderWithRouter();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('contains HomeSidebar', () => {
    renderWithRouter();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});

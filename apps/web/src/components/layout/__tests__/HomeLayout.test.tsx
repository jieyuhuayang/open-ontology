import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import HomeLayout from '@/components/layout/HomeLayout';

vi.mock('@/pages/object-types/components/CreateObjectTypeModal', () => ({
  default: () => null,
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

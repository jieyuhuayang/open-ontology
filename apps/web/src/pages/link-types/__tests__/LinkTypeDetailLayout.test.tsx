import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LinkTypeDetailLayout from '@/pages/link-types/LinkTypeDetailLayout';

describe('LinkTypeDetailLayout', () => {
  function renderWithRouter(path = '/link-types/test-rid/overview') {
    const router = createMemoryRouter(
      [
        {
          path: '/link-types/:rid',
          element: <LinkTypeDetailLayout />,
          children: [
            { path: 'overview', element: <div>Overview Content</div> },
            { path: 'datasources', element: <div>Datasources Content</div> },
          ],
        },
      ],
      { initialEntries: [path] },
    );
    return render(<RouterProvider router={router} />);
  }

  it('shows Overview and Datasources nav items', () => {
    renderWithRouter();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Datasources')).toBeInTheDocument();
  });

  it('does not show Properties nav item', () => {
    renderWithRouter();
    expect(screen.queryByText('Properties')).not.toBeInTheDocument();
  });

  it('renders outlet content', () => {
    renderWithRouter();
    expect(screen.getByText('Overview Content')).toBeInTheDocument();
  });
});

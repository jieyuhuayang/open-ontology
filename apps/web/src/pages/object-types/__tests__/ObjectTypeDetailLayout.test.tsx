import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ObjectTypeDetailLayout from '@/pages/object-types/ObjectTypeDetailLayout';

describe('ObjectTypeDetailLayout', () => {
  function renderWithRouter(path = '/object-types/test-rid/overview') {
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
    return render(<RouterProvider router={router} />);
  }

  it('renders aside and main elements', () => {
    renderWithRouter();
    expect(document.querySelector('aside')).toBeInTheDocument();
    expect(document.querySelector('main')).toBeInTheDocument();
  });

  it('shows Overview, Properties, and Datasources nav items', () => {
    renderWithRouter();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Datasources')).toBeInTheDocument();
  });

  it('renders outlet content', () => {
    renderWithRouter();
    expect(screen.getByText('Overview Content')).toBeInTheDocument();
  });

  it('shows back home link', () => {
    renderWithRouter();
    expect(screen.getByText(/back home/i)).toBeInTheDocument();
  });
});

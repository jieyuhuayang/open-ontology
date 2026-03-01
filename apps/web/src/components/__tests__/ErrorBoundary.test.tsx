import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

function ThrowingComponent() {
  throw new Error('Test error');
}

function renderWithRouter(initialEntries: string[], routes: Parameters<typeof createMemoryRouter>[0]) {
  const router = createMemoryRouter(routes, { initialEntries });
  return render(<RouterProvider router={router} />);
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    renderWithRouter(['/'], [
      {
        path: '/',
        element: <div>Normal content</div>,
        errorElement: <ErrorBoundary />,
      },
    ]);
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('renders error page when child throws', () => {
    renderWithRouter(['/'], [
      {
        path: '/',
        element: <ThrowingComponent />,
        errorElement: <ErrorBoundary />,
      },
    ]);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('shows a back-to-home link', () => {
    renderWithRouter(['/'], [
      {
        path: '/',
        element: <ThrowingComponent />,
        errorElement: <ErrorBoundary />,
      },
    ]);
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});

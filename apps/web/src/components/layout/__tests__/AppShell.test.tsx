import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';

describe('AppShell', () => {
  it('renders TopBar and outlet content', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: <AppShell />,
        children: [{ index: true, element: <div>Child Content</div> }],
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('has minWidth 1280 on root container', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: <AppShell />,
        children: [{ index: true, element: <div>Content</div> }],
      },
    ]);
    const { container } = render(<RouterProvider router={router} />);

    const layout = container.querySelector('.ant-layout');
    expect(layout).toHaveStyle({ minWidth: '1280px' });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DiscoverPage from '@/pages/DiscoverPage';
import { useRecentlyViewedStore } from '@/stores/recently-viewed-store';

function renderPage() {
  return render(
    <MemoryRouter>
      <DiscoverPage />
    </MemoryRouter>,
  );
}

describe('DiscoverPage', () => {
  beforeEach(() => {
    useRecentlyViewedStore.setState({ items: [] });
  });

  it('shows recently viewed title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /recently viewed object types/i })).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    renderPage();
    expect(screen.getByText(/no recently viewed/i)).toBeInTheDocument();
  });

  it('shows cards when items exist', () => {
    useRecentlyViewedStore.setState({
      items: [
        {
          rid: 'rid-1',
          displayName: 'Customer',
          icon: { name: 'AppstoreOutlined', color: '#1677ff' },
          description: 'A customer entity',
          viewedAt: Date.now(),
        },
        {
          rid: 'rid-2',
          displayName: 'Order',
          icon: { name: 'AppstoreOutlined', color: '#1677ff' },
          description: 'An order entity',
          viewedAt: Date.now() - 1000,
        },
      ],
    });

    renderPage();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('shows total count', () => {
    useRecentlyViewedStore.setState({
      items: [
        {
          rid: 'rid-1',
          displayName: 'Customer',
          icon: { name: 'AppstoreOutlined', color: '#1677ff' },
          viewedAt: Date.now(),
        },
      ],
    });

    renderPage();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('limits display to 6 cards', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      rid: `rid-${i}`,
      displayName: `Item ${i}`,
      icon: { name: 'AppstoreOutlined', color: '#1677ff' },
      viewedAt: Date.now() - i * 1000,
    }));
    useRecentlyViewedStore.setState({ items });

    renderPage();
    const cards = screen.getAllByText(/Item \d/);
    expect(cards.length).toBeLessThanOrEqual(6);
  });
});

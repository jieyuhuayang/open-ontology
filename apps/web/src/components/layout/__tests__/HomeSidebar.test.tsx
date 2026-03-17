import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeSidebar from '@/components/layout/HomeSidebar';
import { useSidebarStore } from '@/stores/sidebar-store';

vi.mock('@/api/object-types', () => ({
  useObjectTypes: () => ({ data: { items: [], total: 5 }, isLoading: false }),
}));

vi.mock('@/api/link-types', () => ({
  useLinkTypes: () => ({ data: { items: [], total: 3 }, isLoading: false }),
}));

vi.mock('@/api/search', () => ({
  useSearch: () => ({ data: null, isLoading: false, error: null }),
}));

function renderSidebar(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <HomeSidebar />
    </MemoryRouter>,
  );
}

describe('HomeSidebar', () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false });
  });

  it('renders a nav element', () => {
    renderSidebar();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('displays ontology name', () => {
    renderSidebar();
    expect(screen.getByText(/default ontology/i)).toBeInTheDocument();
  });

  it('shows Discover navigation item', () => {
    renderSidebar();
    expect(screen.getByText('Discover')).toBeInTheDocument();
  });

  it('shows Resources group with Object Types, Properties, Link Types, Action Types', () => {
    renderSidebar();
    expect(screen.getByText('Object Types')).toBeInTheDocument();
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Link Types')).toBeInTheDocument();
    expect(screen.getByText('Action Types')).toBeInTheDocument();
  });

  it('shows actual counts for object types and link types', () => {
    renderSidebar();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('supports collapse toggle via sidebar store', async () => {
    renderSidebar();
    expect(useSidebarStore.getState().collapsed).toBe(false);

    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(true);
  });

  it('renders custom collapse button', () => {
    renderSidebar();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

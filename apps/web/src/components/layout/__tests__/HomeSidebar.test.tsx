import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeSidebar from '@/components/layout/HomeSidebar';
import { useSidebarStore } from '@/stores/sidebar-store';

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

  it('shows dash for resource counts when API is not available', () => {
    renderSidebar();
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('supports collapse toggle via sidebar store', async () => {
    renderSidebar();
    expect(useSidebarStore.getState().collapsed).toBe(false);

    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(true);
  });
});

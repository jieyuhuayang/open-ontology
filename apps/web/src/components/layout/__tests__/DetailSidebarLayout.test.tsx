import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppstoreOutlined, FileTextOutlined, DatabaseOutlined } from '@ant-design/icons';
import DetailSidebarLayout from '@/components/layout/DetailSidebarLayout';
import type { DetailSidebarNavItem } from '@/components/layout/DetailSidebarLayout';

const navItems: DetailSidebarNavItem[] = [
  { key: 'overview', labelKey: 'detail.overview', icon: <FileTextOutlined /> },
  { key: 'properties', labelKey: 'detail.properties', icon: <DatabaseOutlined />, badge: 5 },
  { key: 'datasources', labelKey: 'detail.datasources', icon: <DatabaseOutlined /> },
];

function renderSidebar(activeKey = 'overview') {
  return render(
    <MemoryRouter>
      <DetailSidebarLayout
        resourceName="Customer"
        resourceIcon={<AppstoreOutlined />}
        navItems={navItems}
        backTo="/object-types"
        activeKey={activeKey}
      />
    </MemoryRouter>,
  );
}

describe('DetailSidebarLayout', () => {
  it('renders a nav element', () => {
    renderSidebar();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('shows Back home link pointing to backTo route', () => {
    renderSidebar();
    const backLink = screen.getByText(/back home/i);
    expect(backLink.closest('a')).toHaveAttribute('href', '/object-types');
  });

  it('displays resource name', () => {
    renderSidebar();
    expect(screen.getByText('Customer')).toBeInTheDocument();
  });

  it('renders nav items from config', () => {
    renderSidebar();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Datasources')).toBeInTheDocument();
  });

  it('shows badge count when provided', () => {
    renderSidebar();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('highlights active nav item', () => {
    renderSidebar('properties');
    // The menu should have selectedKeys set to ['properties']
    const menuItems = screen.getAllByRole('menuitem');
    const propertiesItem = menuItems.find((item) => item.textContent?.includes('Properties'));
    expect(propertiesItem).toBeDefined();
    expect(propertiesItem?.className).toContain('selected');
  });

  it('renders optional status badge', () => {
    render(
      <MemoryRouter>
        <DetailSidebarLayout
          resourceName="Customer"
          resourceIcon={<AppstoreOutlined />}
          badges={<span>Draft</span>}
          navItems={navItems}
          backTo="/object-types"
          activeKey="overview"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});

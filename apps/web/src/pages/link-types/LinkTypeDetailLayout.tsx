import { Layout } from 'antd';
import { LinkOutlined, FileTextOutlined, DatabaseOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import DetailSidebarLayout from '@/components/layout/DetailSidebarLayout';
import type { DetailSidebarNavItem } from '@/components/layout/DetailSidebarLayout';

const LT_NAV_ITEMS: DetailSidebarNavItem[] = [
  { key: 'overview', labelKey: 'detail.overview', icon: <FileTextOutlined /> },
  { key: 'datasources', labelKey: 'detail.datasources', icon: <DatabaseOutlined /> },
];

export default function LinkTypeDetailLayout() {
  const { rid } = useParams<{ rid: string }>();
  const location = useLocation();
  const segments = location.pathname.split('/');
  const activeKey = segments[segments.length - 1] || 'overview';

  return (
    <Layout>
      <aside>
        <DetailSidebarLayout
          resourceName={rid ?? ''}
          resourceIcon={<LinkOutlined />}
          navItems={LT_NAV_ITEMS}
          backTo="/link-types"
          activeKey={activeKey}
        />
      </aside>
      <Layout.Content>
        <main style={{ padding: 24 }}>
          <Outlet />
        </main>
      </Layout.Content>
    </Layout>
  );
}

import { Layout } from 'antd';
import { AppstoreOutlined, FileTextOutlined, UnorderedListOutlined, DatabaseOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import DetailSidebarLayout from '@/components/layout/DetailSidebarLayout';
import type { DetailSidebarNavItem } from '@/components/layout/DetailSidebarLayout';

const OT_NAV_ITEMS: DetailSidebarNavItem[] = [
  { key: 'overview', labelKey: 'detail.overview', icon: <FileTextOutlined /> },
  { key: 'properties', labelKey: 'detail.properties', icon: <UnorderedListOutlined /> },
  { key: 'datasources', labelKey: 'detail.datasources', icon: <DatabaseOutlined /> },
];

export default function ObjectTypeDetailLayout() {
  const { rid } = useParams<{ rid: string }>();
  const location = useLocation();
  const segments = location.pathname.split('/');
  const activeKey = segments[segments.length - 1] || 'overview';

  return (
    <Layout>
      <aside>
        <DetailSidebarLayout
          resourceName={rid ?? ''}
          resourceIcon={<AppstoreOutlined />}
          navItems={OT_NAV_ITEMS}
          backTo="/object-types"
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

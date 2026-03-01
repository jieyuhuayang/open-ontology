import { useState, useEffect } from 'react';
import { Layout, Dropdown, Button, Spin } from 'antd';
import {
  FileTextOutlined,
  UnorderedListOutlined,
  DatabaseOutlined,
  MoreOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DetailSidebarLayout from '@/components/layout/DetailSidebarLayout';
import type { DetailSidebarNavItem } from '@/components/layout/DetailSidebarLayout';
import DynamicIcon from '@/components/DynamicIcon';
import StatusBadge from '@/components/StatusBadge';
import ChangeStateBadge from '@/components/ChangeStateBadge';
import DeleteObjectTypeModal from './components/DeleteObjectTypeModal';
import { useObjectType } from '@/api/object-types';
import { useRecentlyViewedStore } from '@/stores/recently-viewed-store';
import type { MenuProps } from 'antd';

const OT_NAV_ITEMS: DetailSidebarNavItem[] = [
  { key: 'overview', labelKey: 'detail.overview', icon: <FileTextOutlined /> },
  { key: 'properties', labelKey: 'detail.properties', icon: <UnorderedListOutlined /> },
  { key: 'datasources', labelKey: 'detail.datasources', icon: <DatabaseOutlined /> },
];

export default function ObjectTypeDetailLayout() {
  const { rid } = useParams<{ rid: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const segments = location.pathname.split('/');
  const activeKey = segments[segments.length - 1] || 'overview';

  const { data, isLoading } = useObjectType(rid ?? '');
  const addRecentItem = useRecentlyViewedStore((s) => s.addItem);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (data) {
      addRecentItem({
        rid: data.rid,
        displayName: data.displayName,
        icon: data.icon,
        description: data.description ?? undefined,
      });
    }
  }, [data, addRecentItem]);

  const isActive = data?.status === 'active';

  const menuItems: MenuProps['items'] = [
    {
      key: 'delete',
      label: t('common.delete'),
      icon: <DeleteOutlined />,
      danger: true,
      disabled: isActive,
      title: isActive ? t('objectType.cannotDeleteActive') : undefined,
    },
  ];

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'delete') setDeleteOpen(true);
  };

  const handleNavClick = (key: string) => {
    navigate(`/object-types/${rid}/${key}`);
  };

  if (isLoading) {
    return (
      <Layout style={{ justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin />
      </Layout>
    );
  }

  if (!data) return null;

  const extra = (
    <Dropdown menu={{ items: menuItems, onClick: onMenuClick }}>
      <Button type="text" size="small" icon={<MoreOutlined />} />
    </Dropdown>
  );

  return (
    <Layout>
      <aside>
        <DetailSidebarLayout
          resourceName={data.displayName}
          resourceIcon={<DynamicIcon name={data.icon.name} color={data.icon.color} />}
          badges={<><StatusBadge status={data.status} /><ChangeStateBadge state={data.changeState} /></>}
          navItems={OT_NAV_ITEMS}
          backTo="/object-types"
          activeKey={activeKey}
          extra={extra}
          onNavClick={handleNavClick}
        />
      </aside>
      <Layout.Content>
        <main style={{ padding: 24 }}>
          <Outlet />
        </main>
      </Layout.Content>
      <DeleteObjectTypeModal
        rid={data.rid}
        displayName={data.displayName}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </Layout>
  );
}

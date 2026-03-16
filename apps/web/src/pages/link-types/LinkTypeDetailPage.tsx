import { useState } from 'react';
import { Layout, Dropdown, Button, Spin } from 'antd';
import {
  FileTextOutlined,
  DatabaseOutlined,
  MoreOutlined,
  DeleteOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DetailSidebarLayout from '@/components/layout/DetailSidebarLayout';
import type { DetailSidebarNavItem } from '@/components/layout/DetailSidebarLayout';
import StatusBadge from '@/components/StatusBadge';
import ChangeStateBadge from '@/components/ChangeStateBadge';
import DeleteLinkTypeModal from './components/DeleteLinkTypeModal';
import LinkTypeOverviewTab from './components/LinkTypeOverviewTab';
import LinkTypeDatasetsTab from './components/LinkTypeDatasetsTab';
import { useLinkType } from '@/api/link-types';
import type { MenuProps } from 'antd';

const LT_NAV_ITEMS: DetailSidebarNavItem[] = [
  { key: 'overview', labelKey: 'linkType.detail.overviewTab', icon: <FileTextOutlined /> },
  { key: 'datasets', labelKey: 'linkType.detail.datasetsTab', icon: <DatabaseOutlined /> },
];

export default function LinkTypeDetailPage() {
  const { rid } = useParams<{ rid: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data, isLoading } = useLinkType(rid ?? '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const isActive = data?.status === 'active';
  const isJoinTable = data?.joinMethod === 'join-table';

  const menuItems: MenuProps['items'] = [
    {
      key: 'delete',
      label: t('common.delete'),
      icon: <DeleteOutlined />,
      danger: true,
      disabled: isActive,
      title: isActive ? t('linkType.cannotDeleteActive') : undefined,
    },
  ];

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'delete') setDeleteOpen(true);
  };

  const handleNavClick = (key: string) => {
    setActiveTab(key);
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

  // Filter nav items: show Datasets tab only for JT link types
  const navItems = isJoinTable
    ? LT_NAV_ITEMS
    : LT_NAV_ITEMS.filter((item) => item.key !== 'datasets');

  return (
    <Layout>
      <aside>
        <DetailSidebarLayout
          resourceName={data.id}
          resourceIcon={<ApiOutlined />}
          badges={
            <>
              <StatusBadge status={data.status} />
              <ChangeStateBadge state={data.changeState} />
            </>
          }
          navItems={navItems}
          backTo="/link-types"
          activeKey={activeTab}
          extra={extra}
          onNavClick={handleNavClick}
        />
      </aside>
      <Layout.Content>
        <main style={{ padding: 24 }}>
          {activeTab === 'overview' && <LinkTypeOverviewTab linkType={data} />}
          {activeTab === 'datasets' && isJoinTable && <LinkTypeDatasetsTab linkType={data} />}
        </main>
      </Layout.Content>
      <DeleteLinkTypeModal
        rid={data.rid}
        displayId={data.id}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onSuccess={() => navigate('/link-types')}
      />
    </Layout>
  );
}

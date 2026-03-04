import { Layout, Menu, Typography } from 'antd';
import {
  CompassOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { MenuProps } from 'antd';

const { Sider } = Layout;
const { Text } = Typography;

export default function HomeSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed } = useSidebarStore();

  const selectedKey = getSelectedKey(location.pathname);

  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <CompassOutlined />,
      label: t('nav.discover'),
    },
    {
      type: 'group',
      label: t('sidebar.resources'),
      children: [
        {
          key: '/object-types',
          icon: <AppstoreOutlined />,
          label: (
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {t('nav.objectTypes')}
              <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
            </span>
          ),
        },
        {
          key: '/properties',
          icon: <UnorderedListOutlined />,
          label: t('nav.properties'),
        },
        {
          key: '/link-types',
          icon: <LinkOutlined />,
          label: (
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {t('nav.linkTypes')}
              <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
            </span>
          ),
        },
        {
          key: '/action-types',
          icon: <ThunderboltOutlined />,
          label: t('nav.actionTypes'),
        },
      ],
    },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={toggleCollapsed}
      width={240}
      style={{ borderRight: '1px solid #f0f0f0' }}
    >
      <nav>
        {!collapsed && (
          <div style={{ padding: '16px 24px 8px' }}>
            <Text strong>{t('sidebar.ontologyName')}</Text>
          </div>
        )}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={onClick}
          style={{ border: 'none' }}
        />
      </nav>
    </Sider>
  );
}

function getSelectedKey(pathname: string): string {
  if (pathname === '/') return '/';
  if (pathname.startsWith('/object-types')) return '/object-types';
  if (pathname.startsWith('/link-types')) return '/link-types';
  if (pathname.startsWith('/properties')) return '/properties';
  if (pathname.startsWith('/action-types')) return '/action-types';
  return '/';
}

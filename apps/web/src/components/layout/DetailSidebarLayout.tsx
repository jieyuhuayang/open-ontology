import type { ReactNode } from 'react';
import { Layout, Menu, Typography, Flex } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';

const { Sider } = Layout;
const { Text } = Typography;

export interface DetailSidebarNavItem {
  key: string;
  labelKey: string;
  icon: ReactNode;
  badge?: number;
}

interface DetailSidebarProps {
  resourceName: string;
  resourceIcon: ReactNode;
  badges?: ReactNode;
  extra?: ReactNode;
  navItems: DetailSidebarNavItem[];
  backTo: string;
  activeKey: string;
  onNavClick?: (key: string) => void;
}

export default function DetailSidebarLayout({
  resourceName,
  resourceIcon,
  badges,
  extra,
  navItems,
  backTo,
  activeKey,
  onNavClick,
}: DetailSidebarProps) {
  const { t } = useTranslation();

  const menuItems: MenuProps['items'] = navItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: (
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t(item.labelKey)}
        {item.badge != null && (
          <Text type="secondary" style={{ fontSize: 12 }}>{item.badge}</Text>
        )}
      </span>
    ),
  }));

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    onNavClick?.(key);
  };

  return (
    <Sider width={240} style={{ borderRight: '1px solid #f0f0f0' }}>
      <nav>
        <div style={{ padding: '12px 16px' }}>
          <Link to={backTo} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeftOutlined />
            {t('sidebar.backHome')}
          </Link>
        </div>

        <div style={{ padding: '8px 16px 16px' }}>
          <Flex align="center" gap={8}>
            {resourceIcon}
            <Text strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {resourceName}
            </Text>
            {statusBadge}
            {extra}
          </Flex>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none' }}
        />
      </nav>
    </Sider>
  );
}

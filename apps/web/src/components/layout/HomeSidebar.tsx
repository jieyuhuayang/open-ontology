import { Layout, Menu, Typography } from 'antd';
import {
  CompassOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useSearchStore, type SearchActiveType } from '@/stores/search-store';
import { useObjectTypes } from '@/api/object-types';
import { useLinkTypes } from '@/api/link-types';
import { useSearch } from '@/api/search';
import type { MenuProps } from 'antd';

const { Sider } = Layout;
const { Text } = Typography;

export default function HomeSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed } = useSidebarStore();
  const { isSearchMode, query, activeType, setActiveType } = useSearchStore();
  const { data: objectTypesData } = useObjectTypes(1, 1);
  const { data: linkTypesData } = useLinkTypes(1, 1, {});
  const { data: searchData } = useSearch(query);

  const selectedKey = getSelectedKey(location.pathname);

  const objectTypeCount = objectTypesData?.total;
  const linkTypeCount = linkTypesData?.total;

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
          label: collapsed ? (
            t('nav.objectTypes')
          ) : (
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {t('nav.objectTypes')}
              {objectTypeCount != null && (
                <Text type="secondary" style={{ fontSize: 12 }}>{objectTypeCount}</Text>
              )}
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
          label: collapsed ? (
            t('nav.linkTypes')
          ) : (
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {t('nav.linkTypes')}
              {linkTypeCount != null && (
                <Text type="secondary" style={{ fontSize: 12 }}>{linkTypeCount}</Text>
              )}
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
    {
      type: 'group',
      label: t('dataConnection.pageTitle'),
      children: [
        {
          key: '/data-connection',
          icon: <DatabaseOutlined />,
          label: t('nav.dataConnection'),
        },
      ],
    },
  ];

  const otSearchCount = searchData?.results?.objectTypes?.total ?? 0;
  const propSearchCount = searchData?.results?.properties?.total ?? 0;
  const ltSearchCount = searchData?.results?.linkTypes?.total ?? 0;

  const searchMenuItems: MenuProps['items'] = [
    {
      key: 'all',
      icon: <SearchOutlined />,
      label: t('search.allResults'),
    },
    {
      key: 'objectType',
      icon: <AppstoreOutlined />,
      label: `${t('search.objectTypes')} (${otSearchCount})`,
    },
    {
      key: 'property',
      icon: <UnorderedListOutlined />,
      label: `${t('search.properties')} (${propSearchCount})`,
    },
    {
      key: 'linkType',
      icon: <LinkOutlined />,
      label: `${t('search.linkTypes')} (${ltSearchCount})`,
    },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={240}
      style={{ borderRight: '1px solid #f0f0f0' }}
    >
      <nav style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {!collapsed && (
          <div style={{ padding: '16px 24px 8px' }}>
            <Text strong>
              {isSearchMode
                ? t('search.results', { count: searchData?.totalCount ?? 0 })
                : t('sidebar.ontologyName')}
            </Text>
          </div>
        )}
        {isSearchMode ? (
          <Menu
            mode="inline"
            selectedKeys={[activeType]}
            items={searchMenuItems}
            onClick={({ key }) => setActiveType(key as SearchActiveType)}
            style={{ border: 'none', flex: 1 }}
          />
        ) : (
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={onClick}
            style={{ border: 'none', flex: 1 }}
          />
        )}
        <div
          role="button"
          tabIndex={0}
          onClick={toggleCollapsed}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleCollapsed();
          }}
          style={{
            borderTop: '1px solid #f0f0f0',
            padding: '12px 0',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          {collapsed ? <RightOutlined /> : <LeftOutlined />}
        </div>
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
  if (pathname.startsWith('/data-connection')) return '/data-connection';
  return '/';
}

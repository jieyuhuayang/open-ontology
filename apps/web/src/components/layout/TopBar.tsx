import { Layout, Typography, Flex } from 'antd';
import { DeploymentUnitOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import SearchBarPlaceholder from './SearchBarPlaceholder';
import CreateMenu from './CreateMenu';
import LanguageSwitcher from './LanguageSwitcher';

const { Header } = Layout;
const { Text } = Typography;

export default function TopBar() {
  const { t } = useTranslation();

  return (
    <Header
      role="banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Flex align="center" gap={12} style={{ flexShrink: 0 }}>
        <DeploymentUnitOutlined style={{ fontSize: 20 }} />
        <Text strong>{t('app.subtitle')}</Text>
      </Flex>

      <Flex align="center" justify="center" style={{ flex: 1, padding: '0 24px' }}>
        <SearchBarPlaceholder />
      </Flex>

      <Flex align="center" gap={16} style={{ flexShrink: 0 }}>
        <div id="branch-selector-slot" />
        <div id="change-status-slot" />
        <CreateMenu />
        <LanguageSwitcher />
      </Flex>
    </Header>
  );
}

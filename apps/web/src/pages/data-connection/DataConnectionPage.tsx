import { Typography, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import ConnectionsTab from './components/ConnectionsTab';
import DatasetsTab from './components/DatasetsTab';

const { Title } = Typography;

export default function DataConnectionPage() {
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useDataConnectionStore();

  const items = [
    {
      key: 'connections',
      label: t('dataConnection.connectionsTab'),
      children: <ConnectionsTab />,
    },
    {
      key: 'datasets',
      label: t('dataConnection.datasetsTab'),
      children: <DatasetsTab />,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        {t('dataConnection.pageTitle')}
      </Title>
      <Tabs activeKey={activeTab} items={items} onChange={(key) => setActiveTab(key as 'connections' | 'datasets')} />
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Button, Spin } from 'antd';
import { DisconnectOutlined, LoadingOutlined } from '@ant-design/icons';
import { useWorkshopStore } from '../stores/workshop-store';

interface ConnectionBannerProps {
  onReconnect: () => void;
}

export default function ConnectionBanner({
  onReconnect,
}: ConnectionBannerProps) {
  const { t } = useTranslation();
  const connectionStatus = useWorkshopStore((s) => s.connectionStatus);

  if (connectionStatus === 'reconnecting') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          background: 'rgba(250, 173, 20, 0.15)',
          border: '1px solid rgba(250, 173, 20, 0.3)',
          borderRadius: 8,
          fontSize: 13,
          color: '#faad14',
          zIndex: 20,
        }}
        data-testid="reconnecting-indicator"
      >
        <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
        {t('workshop.connection.reconnecting')}
      </div>
    );
  }

  if (connectionStatus !== 'disconnected') return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 10, 26, 0.85)',
        zIndex: 30,
        gap: 16,
      }}
      data-testid="connection-banner"
    >
      <DisconnectOutlined
        style={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }}
      />
      <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>
        {t('workshop.connection.disconnected')}
      </div>
      <Button type="primary" onClick={onReconnect}>
        {t('workshop.connection.reconnect')}
      </Button>
    </div>
  );
}

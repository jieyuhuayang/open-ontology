import { Card, Empty, Flex, Typography } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useRecentlyViewedStore } from '@/stores/recently-viewed-store';

const { Title, Text, Paragraph } = Typography;

export default function DiscoverPage() {
  const { t } = useTranslation();
  const items = useRecentlyViewedStore((s) => s.items);

  return (
    <div>
      <Flex align="center" gap={8} style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('discover.recentlyViewed')}
        </Title>
        {items.length > 0 && (
          <Text type="secondary">{items.length}</Text>
        )}
      </Flex>

      {items.length === 0 ? (
        <Empty description={t('discover.noRecentlyViewed')} />
      ) : (
        <Flex wrap="wrap" gap={16}>
          {items.slice(0, 6).map((item) => (
            <Card
              key={item.rid}
              style={{ width: 280 }}
              hoverable
            >
              <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
                <AppstoreOutlined style={{ color: item.icon.color }} />
                <Text strong>{item.displayName}</Text>
              </Flex>
              {item.description && (
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                  {item.description}
                </Paragraph>
              )}
            </Card>
          ))}
        </Flex>
      )}
    </div>
  );
}

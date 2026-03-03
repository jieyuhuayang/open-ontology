import { useEffect, useRef } from 'react';
import { Card, Empty, Flex, Typography, message } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQueries } from '@tanstack/react-query';
import { useRecentlyViewedStore } from '@/stores/recently-viewed-store';
import { objectTypeKeys } from '@/api/object-types';
import apiClient from '@/api/client';
import type { ObjectType } from '@/api/types';

const { Title, Text, Paragraph } = Typography;

export default function DiscoverPage() {
  const { t } = useTranslation();
  const items = useRecentlyViewedStore((s) => s.items);
  const removeItem = useRecentlyViewedStore((s) => s.removeItem);

  // Check each recently viewed item still exists
  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: objectTypeKeys.detail(item.rid),
      queryFn: async () => {
        const { data } = await apiClient.get<ObjectType>(`/object-types/${item.rid}`);
        return data;
      },
      retry: false,
    })),
  });

  const cleanedRef = useRef(new Set<string>());

  useEffect(() => {
    queries.forEach((q, idx) => {
      const item = items[idx];
      if (!item) return;
      if (q.isError && !cleanedRef.current.has(item.rid)) {
        cleanedRef.current.add(item.rid);
        void message.info(t('discover.objectTypeDeleted', { name: item.displayName }));
        removeItem(item.rid);
      }
    });
  }, [queries, items, removeItem, t]);

  // Filter out items that errored (deleted)
  const validItems = items.filter((item) => {
    const idx = items.indexOf(item);
    const q = queries[idx];
    return q && !q.isError;
  });

  return (
    <div>
      <Flex align="center" gap={8} style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('discover.recentlyViewed')}
        </Title>
        {validItems.length > 0 && (
          <Text type="secondary">{validItems.length}</Text>
        )}
      </Flex>

      {validItems.length === 0 ? (
        <Empty description={t('discover.noRecentlyViewed')} />
      ) : (
        <Flex wrap="wrap" gap={16}>
          {validItems.map((item) => (
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

import { Alert, Button, Divider, Spin, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '@/api/search';
import { useSearchStore } from '@/stores/search-store';
import type { SearchResultItem as SearchResultItemType, SearchTypeResult } from '@/api/types';
import SearchResultItemComponent, { navigateToSearchResult } from './SearchResultItem';
import SearchHighlight from './SearchHighlight';

const { Title, Text } = Typography;

const TYPE_ORDER = ['objectTypes', 'properties', 'linkTypes'] as const;
const TYPE_LABELS: Record<string, string> = {
  objectTypes: 'search.objectTypes',
  properties: 'search.properties',
  linkTypes: 'search.linkTypes',
};
const TYPE_KEYS: Record<string, 'objectType' | 'property' | 'linkType'> = {
  objectTypes: 'objectType',
  properties: 'property',
  linkTypes: 'linkType',
};

export default function SearchResultsPanel() {
  const { t } = useTranslation();
  const { query, activeType, setActiveType } = useSearchStore();
  const { data, isLoading, error } = useSearch(query);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message={t('common.error')} style={{ margin: 24 }} />;
  }

  if (!data) return null;

  // All view (grouped)
  if (activeType === 'all') {
    const hasAnyResults = data.totalCount > 0;
    if (!hasAnyResults) {
      return (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Text type="secondary">{t('search.noResults', { query })}</Text>
        </div>
      );
    }

    return (
      <div style={{ padding: '0 8px' }}>
        {TYPE_ORDER.map((typeKey) => {
          const group: SearchTypeResult | undefined = data.results[typeKey];
          if (!group || group.total === 0) return null;

          return (
            <div key={typeKey} style={{ marginBottom: 24 }}>
              <Title level={5} style={{ margin: '16px 0 8px' }}>
                {t(TYPE_LABELS[typeKey])} ({group.total})
              </Title>
              {group.items.slice(0, 5).map((item) => (
                <SearchResultItemComponent key={item.rid} item={item} query={query} />
              ))}
              {group.total > 5 && (
                <Button type="link" onClick={() => setActiveType(TYPE_KEYS[typeKey])}>
                  {t('search.showAll')}
                </Button>
              )}
              <Divider style={{ margin: '8px 0' }} />
            </div>
          );
        })}
      </div>
    );
  }

  // Filtered view (single type as table)
  const typeKeyMap: Record<string, string> = {
    objectType: 'objectTypes',
    property: 'properties',
    linkType: 'linkTypes',
  };
  const group: SearchTypeResult | undefined = data.results[typeKeyMap[activeType]];
  const items = group?.items ?? [];

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Text type="secondary">{t('search.noResults', { query })}</Text>
      </div>
    );
  }

  const baseColumns = [
    {
      title: 'NAME',
      dataIndex: 'displayName',
      key: 'name',
      render: (_: string, record: SearchResultItemType) => (
        <SearchHighlight text={record.displayName} query={query} />
      ),
    },
    { title: 'STATUS', dataIndex: 'status', key: 'status', width: 120 },
    { title: 'VISIBILITY', dataIndex: 'visibility', key: 'visibility', width: 120 },
  ];

  const extraColumns =
    activeType === 'property'
      ? [
          {
            title: 'OBJECT TYPE',
            dataIndex: 'objectTypeDisplayName',
            key: 'objectType',
            width: 160,
          },
          { title: 'BASE TYPE', dataIndex: 'baseType', key: 'baseType', width: 120 },
        ]
      : activeType === 'linkType'
        ? [
            {
              title: 'SIDE A',
              dataIndex: 'sideADisplayName',
              key: 'sideA',
              width: 160,
            },
            {
              title: 'SIDE B',
              dataIndex: 'sideBDisplayName',
              key: 'sideB',
              width: 160,
            },
          ]
        : [];

  return (
    <Table
      dataSource={items}
      columns={[...baseColumns, ...extraColumns]}
      rowKey="rid"
      pagination={false}
      size="small"
    />
  );
}

import { useState, useMemo } from 'react';
import { Empty, Flex, Select, Table, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAllProperties } from '@/api/properties';
import StatusBadge from '@/components/StatusBadge';
import ChangeStateBadge from '@/components/ChangeStateBadge';
import type { ColumnsType } from 'antd/es/table';
import type {
  PropertyWithObjectType,
  ResourceStatus,
  Visibility,
  ChangeState,
} from '@/api/types';

const { Title } = Typography;

export default function PropertiesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useAllProperties();

  const [statusFilter, setStatusFilter] = useState<ResourceStatus[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<Visibility[]>([]);
  const [baseTypeFilter, setBaseTypeFilter] = useState<string[]>([]);
  const [objectTypeFilter, setObjectTypeFilter] = useState<string | undefined>(undefined);

  const objectTypeOptions = useMemo(() => {
    if (!data?.items) return [];
    const seen = new Map<string, string>();
    for (const item of data.items) {
      if (!seen.has(item.objectTypeRid)) {
        seen.set(item.objectTypeRid, item.objectTypeDisplayName);
      }
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [data?.items]);

  const baseTypeOptions = useMemo(() => {
    if (!data?.items) return [];
    const types = new Set(data.items.map((item) => item.baseType));
    return Array.from(types).map((bt) => ({
      value: bt,
      label: t(`property.baseTypes.${bt}`, bt),
    }));
  }, [data?.items, t]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (statusFilter.length > 0 && !statusFilter.includes(item.status as ResourceStatus))
        return false;
      if (
        visibilityFilter.length > 0 &&
        !visibilityFilter.includes(item.visibility as Visibility)
      )
        return false;
      if (baseTypeFilter.length > 0 && !baseTypeFilter.includes(item.baseType)) return false;
      if (objectTypeFilter && item.objectTypeRid !== objectTypeFilter) return false;
      return true;
    });
  }, [data?.items, statusFilter, visibilityFilter, baseTypeFilter, objectTypeFilter]);

  const handleRowClick = (record: PropertyWithObjectType) => {
    navigate(`/object-types/${record.objectTypeRid}/properties?highlight=${record.rid}`);
  };

  const isGlobalEmpty = !isLoading && data?.total === 0;
  const isFilterEmpty = !isLoading && !isGlobalEmpty && filteredItems.length === 0;

  const columns: ColumnsType<PropertyWithObjectType> = [
    {
      title: t('property.fields.displayName'),
      key: 'displayName',
      render: (_, record) => (
        <span>
          {record.displayName}{' '}
          <ChangeStateBadge state={record.changeState as ChangeState} />
        </span>
      ),
    },
    {
      title: t('property.columns.objectType'),
      key: 'objectType',
      width: 180,
      render: (_, record) => record.objectTypeDisplayName,
    },
    {
      title: t('property.fields.baseType'),
      key: 'baseType',
      width: 140,
      render: (_, record) => (
        <span>
          {t(`property.baseTypes.${record.baseType}`, record.baseType)}
          {record.baseType === 'array' && record.arrayInnerType && (
            <Tag style={{ marginLeft: 4, fontSize: 11 }}>
              {t(`property.baseTypes.${record.arrayInnerType}`, record.arrayInnerType)}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: t('property.fields.status'),
      key: 'status',
      width: 120,
      render: (_, record) => <StatusBadge status={record.status as ResourceStatus} />,
    },
    {
      title: t('property.fields.visibility'),
      dataIndex: 'visibility',
      key: 'visibility',
      width: 100,
    },
  ];

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('property.summaryTitle')}
        </Title>
      </Flex>

      {isGlobalEmpty ? (
        <Empty description={t('property.summaryEmpty')} />
      ) : (
        <>
          <Flex gap={12} style={{ marginBottom: 16 }}>
            <Select
              placeholder={t('property.filters.objectType')}
              value={objectTypeFilter}
              onChange={setObjectTypeFilter}
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={objectTypeOptions}
              style={{ minWidth: 200 }}
            />
            <Select
              mode="multiple"
              placeholder={t('property.filters.status')}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ minWidth: 160 }}
              options={[
                { value: 'active', label: t('objectType.status.active') },
                { value: 'experimental', label: t('objectType.status.experimental') },
                { value: 'deprecated', label: t('objectType.status.deprecated') },
              ]}
            />
            <Select
              mode="multiple"
              placeholder={t('property.filters.visibility')}
              value={visibilityFilter}
              onChange={setVisibilityFilter}
              allowClear
              style={{ minWidth: 160 }}
              options={[
                { value: 'prominent', label: t('objectType.visibility.prominent') },
                { value: 'normal', label: t('objectType.visibility.normal') },
                { value: 'hidden', label: t('objectType.visibility.hidden') },
              ]}
            />
            <Select
              mode="multiple"
              placeholder={t('property.filters.baseType')}
              value={baseTypeFilter}
              onChange={setBaseTypeFilter}
              allowClear
              style={{ minWidth: 160 }}
              options={baseTypeOptions}
            />
          </Flex>
          {isFilterEmpty ? (
            <Empty description={t('property.summaryFilterEmpty')} />
          ) : (
            <Table<PropertyWithObjectType>
              columns={columns}
              dataSource={filteredItems}
              rowKey="rid"
              size="small"
              pagination={{ pageSize: 50 }}
              loading={isLoading}
              onRow={(record) => ({
                onClick: () => handleRowClick(record),
                style: { cursor: 'pointer' },
              })}
            />
          )}
        </>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Button, Empty, Flex, Select, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useObjectTypes } from '@/api/object-types';
import { useCreateObjectTypeModalStore } from '@/stores/create-object-type-modal-store';
import ObjectTypeTable from './components/ObjectTypeTable';
import type { ResourceStatus, Visibility } from '@/api/types';

const { Title } = Typography;

export default function ObjectTypeListPage() {
  const { t } = useTranslation();
  const openCreateModal = useCreateObjectTypeModalStore((s) => s.open);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<ResourceStatus[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<Visibility[]>([]);

  const { data, isLoading } = useObjectTypes(page, pageSize);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (statusFilter.length > 0 && !statusFilter.includes(item.status)) return false;
      if (visibilityFilter.length > 0 && !visibilityFilter.includes(item.visibility)) return false;
      return true;
    });
  }, [data?.items, statusFilter, visibilityFilter]);

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  const isGlobalEmpty = !isLoading && data?.total === 0;
  const isFilterEmpty = !isLoading && !isGlobalEmpty && filteredItems.length === 0;

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('objectType.listTitle')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          {t('objectType.newObjectType')}
        </Button>
      </Flex>

      {isGlobalEmpty ? (
        <Empty
          description={
            <span>
              <div>{t('objectType.emptyTitle')}</div>
              <div style={{ color: '#8c8c8c', marginTop: 4 }}>{t('objectType.emptyDescription')}</div>
            </span>
          }
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            {t('objectType.newObjectType')}
          </Button>
        </Empty>
      ) : (
        <>
          <Flex gap={12} style={{ marginBottom: 16 }}>
            <Select
              mode="multiple"
              placeholder={t('objectType.fields.status')}
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
              placeholder={t('objectType.fields.visibility')}
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
          </Flex>
          {isFilterEmpty ? (
            <Empty description={t('objectType.filterEmpty')} />
          ) : (
            <ObjectTypeTable
              items={filteredItems}
              loading={isLoading}
              total={data?.total ?? 0}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}

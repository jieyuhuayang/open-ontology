import { useState, useMemo, useCallback } from 'react';
import { Button, Empty, Flex, Select, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useLinkTypes } from '@/api/link-types';
import { useObjectTypes } from '@/api/object-types';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';
import LinkTypeTable from './components/LinkTypeTable';
import LinkTypeDetailDrawer from './components/LinkTypeDetailDrawer';
import CreateLinkTypeWizard from './components/CreateLinkTypeWizard';
import type { ResourceStatus, Visibility } from '@/api/types';

const { Title } = Typography;

export default function LinkTypeListPage() {
  const { t } = useTranslation();
  const openCreateModal = useCreateLinkTypeModalStore((s) => s.open);
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<ResourceStatus[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<Visibility[]>([]);
  const [objectTypeFilter, setObjectTypeFilter] = useState<string | undefined>(undefined);

  const selectedRid = searchParams.get('selected');
  const { data, isLoading } = useLinkTypes(page, pageSize);
  const { data: objectTypesData } = useObjectTypes(1, 100);

  const objectTypeOptions = useMemo(() => {
    if (!objectTypesData?.items) return [];
    return objectTypesData.items
      .filter((ot) => ot.changeState !== 'deleted')
      .map((ot) => ({
        value: ot.rid,
        label: ot.displayName,
      }));
  }, [objectTypesData?.items]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (statusFilter.length > 0 && !statusFilter.includes(item.status)) return false;
      if (
        visibilityFilter.length > 0 &&
        !visibilityFilter.includes(item.sideA.visibility) &&
        !visibilityFilter.includes(item.sideB.visibility)
      )
        return false;
      if (
        objectTypeFilter &&
        item.sideA.objectTypeRid !== objectTypeFilter &&
        item.sideB.objectTypeRid !== objectTypeFilter
      )
        return false;
      return true;
    });
  }, [data?.items, statusFilter, visibilityFilter, objectTypeFilter]);

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  const handleRowClick = useCallback(
    (rid: string) => {
      setSearchParams({ selected: rid });
    },
    [setSearchParams],
  );

  const handleDrawerClose = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const isGlobalEmpty = !isLoading && data?.total === 0;
  const isFilterEmpty = !isLoading && !isGlobalEmpty && filteredItems.length === 0;

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('linkType.listTitle')}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
          {t('linkType.newLinkType')}
        </Button>
      </Flex>

      {isGlobalEmpty ? (
        <Empty
          description={
            <span>
              <div>{t('linkType.emptyTitle')}</div>
              <div style={{ color: '#8c8c8c', marginTop: 4 }}>
                {t('linkType.emptyDescription')}
              </div>
            </span>
          }
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
            {t('linkType.newLinkType')}
          </Button>
        </Empty>
      ) : (
        <>
          <Flex gap={12} style={{ marginBottom: 16 }}>
            <Select
              placeholder={t('linkType.filters.objectType')}
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
              placeholder={t('linkType.fields.status')}
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
              placeholder={t('linkType.fields.visibility')}
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
            <Empty description={t('linkType.filterEmpty')} />
          ) : (
            <LinkTypeTable
              items={filteredItems}
              loading={isLoading}
              total={data?.total ?? 0}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onRowClick={handleRowClick}
            />
          )}
        </>
      )}

      <LinkTypeDetailDrawer rid={selectedRid} onClose={handleDrawerClose} />
      <CreateLinkTypeWizard />
    </div>
  );
}

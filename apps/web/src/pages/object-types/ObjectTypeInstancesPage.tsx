import { useState } from 'react';
import { Table, Button, Tag, Space, Typography, Alert } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useObjectInstances, useSyncStatus, useTriggerSync } from '@/api/object-instances';
import { useObjectType } from '@/api/object-types';
import { useProperties } from '@/api/properties';
import type { ColumnsType } from 'antd/es/table';
import type { ObjectInstanceItem } from '@/api/object-instances';

export default function ObjectTypeInstancesPage() {
  const { rid: otRid = '' } = useParams<{ rid: string }>();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: otData } = useObjectType(otRid);
  const { data: propsData } = useProperties(otRid);
  const { data: instancesData, isLoading } = useObjectInstances(otRid, page, pageSize);
  const { data: syncStatus } = useSyncStatus(otRid);
  const triggerSync = useTriggerSync(otRid);

  const properties = propsData?.items ?? [];

  const columns: ColumnsType<ObjectInstanceItem> = [
    {
      title: '#',
      key: 'index',
      width: 60,
      render: (_v, _r, index) => (page - 1) * pageSize + index + 1,
    },
    ...properties
      .filter((p) => p.backingColumn)
      .map((prop) => ({
        title: prop.displayName,
        dataIndex: ['properties', prop.apiName],
        key: prop.apiName,
        ellipsis: true,
        render: (value: unknown) => {
          if (value === null || value === undefined) return '-';
          return String(value);
        },
      })),
  ];

  const hasDatasource =
    !!otData?.backingDatasource &&
    typeof otData.backingDatasource === 'object' &&
    'rid' in otData.backingDatasource;

  const renderSyncBar = () => {
    if (!syncStatus) {
      return (
        <Alert
          type="info"
          message={t('instances.noSyncYet')}
          description={hasDatasource ? t('instances.publishToSync') : t('instances.configureDatasource')}
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }

    const statusIcon =
      syncStatus.status === 'completed' ? (
        <CheckCircleOutlined style={{ color: '#52c41a' }} />
      ) : syncStatus.status === 'failed' ? (
        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      ) : (
        <SyncOutlined spin style={{ color: '#1677ff' }} />
      );

    const statusColor =
      syncStatus.status === 'completed'
        ? 'success'
        : syncStatus.status === 'failed'
          ? 'error'
          : 'processing';

    return (
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          {statusIcon}
          <Tag color={statusColor}>{t(`instances.syncStatus.${syncStatus.status}`)}</Tag>
          {syncStatus.completedAt && (
            <Typography.Text type="secondary">
              {t('instances.lastSynced', {
                time: new Date(syncStatus.completedAt).toLocaleString(),
              })}
            </Typography.Text>
          )}
          {syncStatus.status === 'completed' && (
            <Typography.Text type="secondary">
              {t('instances.syncStats', {
                inserted: syncStatus.insertedCount,
                updated: syncStatus.updatedCount,
                deleted: syncStatus.deletedCount,
              })}
            </Typography.Text>
          )}
        </Space>
        <Button
          icon={<SyncOutlined />}
          onClick={() => triggerSync.mutate()}
          loading={triggerSync.isPending}
          disabled={!hasDatasource}
        >
          {t('instances.syncNow')}
        </Button>
      </Space>
    );
  };

  return (
    <div>
      <Typography.Title level={5} style={{ marginBottom: 16 }}>
        {t('instances.title')}
      </Typography.Title>

      {renderSyncBar()}

      <Table<ObjectInstanceItem>
        columns={columns}
        dataSource={instancesData?.items ?? []}
        rowKey="rid"
        loading={isLoading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total: instancesData?.total ?? 0,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />
    </div>
  );
}

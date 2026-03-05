import { Table, Tag, Tooltip, Button, Popconfirm, Space, App, Input, Drawer, Dropdown } from 'antd';
import { DeleteOutlined, EyeOutlined, SearchOutlined, PlusOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useDatasets, useDeleteDataset, useDatasetPreview } from '@/api/datasets';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import { useState } from 'react';
import type { DatasetListItem } from '@/api/types';
import type { ColumnsType } from 'antd/es/table';

function formatRowCount(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}K`;
  return val.toLocaleString();
}

function formatRelativeTime(val: string | null | undefined): string {
  if (!val) return '—';
  const date = new Date(val);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return '< 1 min';
  if (diffMin < 60) return `${diffMin} min`;
  if (diffHr < 24) return `${diffHr} hr`;
  if (diffDay < 30) return `${diffDay} d`;
  return date.toLocaleDateString();
}

function PreviewDrawer({ rid, onClose }: { rid: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useDatasetPreview(rid, 50);

  const columns =
    data?.columns?.map((col) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      ellipsis: true,
    })) ?? [];

  return (
    <Drawer title={t('dataset.listTitle')} open width={800} onClose={onClose} destroyOnClose>
      <Table
        rowKey={(_, index) => String(index)}
        columns={columns}
        dataSource={data?.rows ?? []}
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20 }}
        size="small"
      />
    </Drawer>
  );
}

export default function DatasetsTab() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useDatasets(search || undefined);
  const deleteMutation = useDeleteDataset();
  const { previewDatasetRid, setPreviewDatasetRid } = useDataConnectionStore();
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);

  const handleDelete = async (rid: string) => {
    try {
      await deleteMutation.mutateAsync(rid);
      message.success(t('dataset.deleteSuccess'));
    } catch {
      message.error(t('dataset.deleteInUse'));
    }
  };

  const importMenuItems = [
    {
      key: 'mysql',
      label: t('dataset.fromMySQL'),
      onClick: () => setOpenModal('mysqlImport'),
    },
    {
      key: 'file',
      label: t('dataset.uploadFile'),
      onClick: () => setOpenModal('fileUpload'),
    },
  ];

  const columns: ColumnsType<DatasetListItem> = [
    {
      title: t('dataset.columns.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('dataset.columns.source'),
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 100,
      render: (val: string) => <Tag>{t(`dataset.source.${val}`)}</Tag>,
    },
    {
      title: t('dataset.columns.rows'),
      dataIndex: 'rowCount',
      key: 'rowCount',
      width: 100,
      render: (val: number) => formatRowCount(val),
    },
    {
      title: t('dataset.columns.columns'),
      dataIndex: 'columnCount',
      key: 'columnCount',
      width: 100,
    },
    {
      title: t('dataConnection.status'),
      key: 'inUse',
      width: 120,
      render: (_: unknown, record: DatasetListItem) => {
        if (record.inUse) {
          return (
            <Tooltip title={t('dataset.inUseTooltip', { name: record.linkedObjectTypeName ?? '' })}>
              <Tag color="blue">{t('dataset.inUse')}</Tag>
            </Tooltip>
          );
        }
        return <Tag color="green">{t('dataset.available')}</Tag>;
      },
    },
    {
      title: t('dataset.columns.importedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val: string) => formatRelativeTime(val),
    },
    {
      key: 'actions',
      width: 120,
      render: (_: unknown, record: DatasetListItem) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewDatasetRid(record.rid)} />
          <Popconfirm
            title={t('common.delete')}
            description={record.inUse ? t('dataset.deleteInUse') : undefined}
            onConfirm={() => handleDelete(record.rid)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            disabled={record.inUse}
          >
            <Button size="small" danger icon={<DeleteOutlined />} disabled={record.inUse} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('topBar.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 320 }}
        />
        <Dropdown menu={{ items: importMenuItems }} trigger={['click']}>
          <Button type="primary" icon={<PlusOutlined />}>
            {t('dataset.importDataset')} <DownOutlined />
          </Button>
        </Dropdown>
      </div>
      <Table<DatasetListItem>
        rowKey="rid"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading}
        pagination={false}
        locale={{ emptyText: t('dataset.noDatasets') }}
      />
      {previewDatasetRid && <PreviewDrawer rid={previewDatasetRid} onClose={() => setPreviewDatasetRid(null)} />}
    </div>
  );
}

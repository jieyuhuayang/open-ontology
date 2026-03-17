import { useState } from 'react';
import { Flex, Input, Modal, Table, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDatasets, useDatasetPreview } from '@/api/datasets';
import type { DatasetListItem } from '@/api/types';

const { Text } = Typography;

const SOURCE_LABEL: Record<string, string> = {
  mysql: 'MySQL',
  excel: 'Excel',
  csv: 'CSV',
};

interface DatasetSelectorModalProps {
  open: boolean;
  currentDatasetRid?: string;
  onSelect: (rid: string) => void;
  onCancel: () => void;
}

export default function DatasetSelectorModal({
  open,
  currentDatasetRid,
  onSelect,
  onCancel,
}: DatasetSelectorModalProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedRid, setSelectedRid] = useState<string | undefined>();
  const [hoveredRid, setHoveredRid] = useState<string | undefined>();

  const { data: datasetsData } = useDatasets(search || undefined);
  const datasets = datasetsData?.items ?? [];

  const sortedDatasets = [...datasets].sort((a, b) => {
    if (a.inUse !== b.inUse) return a.inUse ? 1 : -1;
    return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime();
  });

  const previewRid = selectedRid ?? hoveredRid ?? '';
  const { data: preview } = useDatasetPreview(previewRid, 5);

  const columns = [
    {
      title: t('dataset.columns.name'),
      dataIndex: 'name',
      key: 'name',
      render: (val: string, record: DatasetListItem) => (
        <Flex align="center" gap={8}>
          <Text>{val}</Text>
          {record.inUse && (
            <Tooltip
              title={t('dataset.inUseTooltip', {
                name: record.linkedObjectTypeName ?? '',
              })}
            >
              <Tag color="default">{t('dataset.inUse')}</Tag>
            </Tooltip>
          )}
          {record.mode === 'live' && (
            <Tag color="green" bordered={false}>
              ● {t('dataset.liveLabel')}
            </Tag>
          )}
        </Flex>
      ),
    },
    {
      title: t('dataset.columns.source'),
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 80,
      render: (val: string) => SOURCE_LABEL[val] ?? val,
    },
    {
      title: t('dataset.columns.rows'),
      dataIndex: 'rowCount',
      key: 'rowCount',
      width: 80,
    },
    {
      title: t('dataset.columns.columns'),
      dataIndex: 'columnCount',
      key: 'columnCount',
      width: 80,
    },
  ];

  const previewCols =
    preview?.columns.map((col) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      width: 120,
      ellipsis: true,
    })) ?? [];

  const isSelectable = (record: DatasetListItem) =>
    !record.inUse || record.rid === currentDatasetRid;

  return (
    <Modal
      title={t('objectType.selectDatasource')}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (selectedRid) onSelect(selectedRid);
      }}
      okButtonProps={{ disabled: !selectedRid }}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      width={800}
      destroyOnClose
    >
      <Flex vertical gap={16}>
        <Input.Search
          placeholder={t('dataset.selectDataset')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />

        <Table
          dataSource={sortedDatasets}
          columns={columns}
          rowKey="rid"
          size="small"
          pagination={false}
          locale={{ emptyText: t('dataset.noDatasets') }}
          onRow={(record: DatasetListItem) => ({
            onClick: () => {
              if (isSelectable(record)) {
                setSelectedRid(record.rid);
              }
            },
            onMouseEnter: () => setHoveredRid(record.rid),
            onMouseLeave: () => setHoveredRid(undefined),
            style: {
              cursor: isSelectable(record) ? 'pointer' : 'not-allowed',
              opacity: isSelectable(record) ? 1 : 0.5,
              background: selectedRid === record.rid ? '#e6f4ff' : undefined,
            },
          })}
        />

        {(selectedRid || hoveredRid) && preview && (
          <Flex vertical gap={8}>
            <Text strong style={{ fontSize: 13 }}>
              {t('objectType.dataPreview')} ({preview.columns.length} {t('dataset.columns.columns')})
            </Text>
            <Table
              dataSource={preview.rows.slice(0, 5)}
              columns={previewCols}
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowKey={(_, i) => String(i)}
            />
          </Flex>
        )}
      </Flex>
    </Modal>
  );
}

import { useState } from 'react';
import {
  Button,
  Flex,
  Input,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useDatasets, useDatasetPreview } from '@/api/datasets';
import { useCreateWizardStore } from '@/stores/create-wizard-store';
import MySQLImportWizard from './MySQLImportWizard';
import FileUploadWizard from './FileUploadWizard';
import type { DatasetListItem } from '@/api/types';

const { Text } = Typography;

const SOURCE_LABEL: Record<string, string> = {
  mysql: 'MySQL',
  excel: 'Excel',
  csv: 'CSV',
};

export default function WizardStepDatasource() {
  const { t } = useTranslation();
  const { selectedDatasetRid, setSelectedDataset, nextStep } = useCreateWizardStore();
  const [search, setSearch] = useState('');
  const [hoveredRid, setHoveredRid] = useState<string | undefined>();
  const [mysqlOpen, setMysqlOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);

  const { data: datasetsData } = useDatasets(search || undefined);
  const datasets = datasetsData?.items ?? [];

  const previewRid = selectedDatasetRid ?? hoveredRid ?? '';
  const { data: preview } = useDatasetPreview(previewRid, 5);

  const handleSelectDataset = (rid: string) => {
    setSelectedDataset(rid);
  };

  const handleUseDataset = () => {
    if (selectedDatasetRid) {
      nextStep();
    }
  };

  const handleImportSuccess = (datasetRid: string) => {
    setSelectedDataset(datasetRid);
    nextStep();
  };

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
    {
      title: t('dataset.columns.importedAt'),
      dataIndex: 'importedAt',
      key: 'importedAt',
      width: 160,
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '-'),
    },
  ];

  const previewCols = preview?.columns.map((col) => ({
    title: col.name,
    dataIndex: col.name,
    key: col.name,
    width: 120,
    ellipsis: true,
  })) ?? [];

  return (
    <Flex vertical gap={16}>
      <Input.Search
        placeholder={t('dataset.selectDataset')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
      />

      <Table
        dataSource={datasets}
        columns={columns}
        rowKey="rid"
        size="small"
        pagination={false}
        locale={{ emptyText: t('dataset.noDatasets') }}
        onRow={(record: DatasetListItem) => ({
          onClick: () => {
            if (!record.inUse) {
              handleSelectDataset(record.rid);
            }
          },
          onMouseEnter: () => setHoveredRid(record.rid),
          onMouseLeave: () => setHoveredRid(undefined),
          style: {
            cursor: record.inUse ? 'not-allowed' : 'pointer',
            opacity: record.inUse ? 0.5 : 1,
            background: selectedDatasetRid === record.rid ? '#e6f4ff' : undefined,
          },
        })}
      />

      {(selectedDatasetRid || hoveredRid) && preview && (
        <Flex vertical gap={8}>
          <Text strong style={{ fontSize: 13 }}>
            {t('dataset.columns.columns')} ({preview.columns.length})
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

      <Flex gap={8} justify="flex-end">
        <Button onClick={() => setFileOpen(true)}>{t('dataset.uploadFile')}</Button>
        <Button onClick={() => setMysqlOpen(true)}>{t('dataset.importFromMySQL')}</Button>
        <Button
          type="primary"
          disabled={!selectedDatasetRid}
          onClick={handleUseDataset}
        >
          {t('dataset.useThisDataset')}
        </Button>
      </Flex>

      <MySQLImportWizard
        open={mysqlOpen}
        onClose={() => setMysqlOpen(false)}
        onSuccess={handleImportSuccess}
      />
      <FileUploadWizard
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </Flex>
  );
}

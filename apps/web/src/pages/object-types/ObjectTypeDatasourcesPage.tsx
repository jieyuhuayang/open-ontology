import { useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Flex,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  DatabaseOutlined,
  DeleteOutlined,
  SwapOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useObjectType, useUpdateObjectType } from '@/api/object-types';
import { useDataset, useDatasetPreview } from '@/api/datasets';
import DatasetSelectorModal from './components/DatasetSelectorModal';

const { Title, Text } = Typography;

export default function ObjectTypeDatasourcesPage() {
  const { rid } = useParams<{ rid: string }>();
  const { t } = useTranslation();
  const { data: objectType } = useObjectType(rid ?? '');
  const updateMutation = useUpdateObjectType(rid ?? '');
  const [selectorOpen, setSelectorOpen] = useState(false);

  const datasetRid = objectType?.backingDatasource?.rid ?? '';
  const { data: dataset } = useDataset(datasetRid);
  const { data: preview } = useDatasetPreview(datasetRid, 10);

  if (!objectType) return null;

  const hasDataSource = !!objectType.backingDatasource;

  const handleSelect = async (newRid: string) => {
    await updateMutation.mutateAsync({ backingDatasourceRid: newRid });
    setSelectorOpen(false);
  };

  const handleRemove = async () => {
    await updateMutation.mutateAsync({ backingDatasourceRid: null });
  };

  const schemaCols = [
    {
      title: t('dataset.columns.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('dataset.columns.source'),
      dataIndex: 'inferredType',
      key: 'inferredType',
    },
  ];

  const previewCols =
    preview?.columns.map((col) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      width: 150,
      ellipsis: true,
    })) ?? [];

  return (
    <Flex vertical gap={16}>
      {hasDataSource && dataset ? (
        <>
          {/* Info card */}
          <Card>
            <Flex justify="space-between" align="flex-start">
              <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
                <DatabaseOutlined style={{ fontSize: 20 }} />
                <Title level={5} style={{ margin: 0 }}>
                  {dataset.name}
                </Title>
                <Tag color={dataset.mode === 'live' ? 'green' : 'blue'}>
                  {dataset.mode === 'live'
                    ? t('dataset.modeLive')
                    : t('dataset.modeSnapshot')}
                </Tag>
                <Tag>{dataset.sourceType?.toUpperCase()}</Tag>
              </Flex>
              <Space>
                <Button
                  icon={<SwapOutlined />}
                  onClick={() => setSelectorOpen(true)}
                >
                  {t('objectType.changeDatasource')}
                </Button>
                <Popconfirm
                  title={t('objectType.removeDatasourceConfirm')}
                  onConfirm={handleRemove}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    {t('objectType.removeDatasource')}
                  </Button>
                </Popconfirm>
              </Space>
            </Flex>
            <Descriptions size="small" column={3}>
              <Descriptions.Item label={t('dataset.columns.rows')}>
                {dataset.mode === 'live' ? '—' : (dataset.rowCount ?? '—')}
              </Descriptions.Item>
              <Descriptions.Item label={t('dataset.columns.columns')}>
                {dataset.columnCount ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('dataset.columns.importedAt')}>
                {dataset.createdAt
                  ? new Date(dataset.createdAt).toLocaleString()
                  : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Column Schema */}
          <Card
            title={t('objectType.columnSchema')}
            size="small"
          >
            <Table
              dataSource={preview?.columns ?? []}
              columns={schemaCols}
              rowKey="name"
              size="small"
              pagination={false}
            />
          </Card>

          {/* Data Preview */}
          <Card
            title={`${t('objectType.dataPreview')} (${preview?.rows.length ?? 0} ${t('import.rows')})`}
            size="small"
          >
            <Table
              dataSource={preview?.rows ?? []}
              columns={previewCols}
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowKey={(_, i) => String(i)}
            />
          </Card>
        </>
      ) : (
        <Card>
          <Flex vertical align="center" gap={16} style={{ padding: '40px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('objectType.noDatasource')}
            />
            <Space direction="vertical" align="center">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setSelectorOpen(true)}
              >
                {t('objectType.addDatasource')}
              </Button>
              <Link to="/data-connection">
                {t('objectType.goToDataConnection')}
              </Link>
            </Space>
          </Flex>
        </Card>
      )}

      <DatasetSelectorModal
        open={selectorOpen}
        currentDatasetRid={datasetRid || undefined}
        onSelect={handleSelect}
        onCancel={() => setSelectorOpen(false)}
      />
    </Flex>
  );
}

import { useState } from 'react';
import {
  Button,
  Flex,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
  Input,
  Modal,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateWizardStore } from '@/stores/create-wizard-store';
import { useDataset } from '@/api/datasets';
import type { WizardProperty } from '@/stores/create-wizard-store';
import type { PropertyBaseType } from '@/api/types';

const { Text } = Typography;

const BASE_TYPE_OPTIONS: PropertyBaseType[] = [
  'string', 'integer', 'long', 'float', 'double', 'decimal',
  'boolean', 'date', 'timestamp',
];

function generateId(): string {
  return `prop-${Math.random().toString(36).slice(2, 8)}`;
}

export default function WizardStepProperties() {
  const { t } = useTranslation();
  const { selectedDatasetRid, properties, addProperty, removeProperty, updateProperty } =
    useCreateWizardStore();

  const { data: dataset } = useDataset(selectedDatasetRid ?? '');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<PropertyBaseType>('string');
  const [newPropColumn, setNewPropColumn] = useState<string | undefined>(undefined);

  const datasetColumns = dataset?.columns ?? [];

  const handleAddAll = () => {
    const mapped = new Set(properties.map((p) => p.columnName).filter(Boolean));
    const unmapped = datasetColumns.filter((col) => !mapped.has(col.name));
    unmapped.forEach((col) => {
      addProperty({
        id: generateId(),
        displayName: col.name,
        baseType: 'string',
        columnName: col.name,
      });
    });
  };

  const handleAddManual = () => {
    if (!newPropName.trim()) return;
    addProperty({
      id: generateId(),
      displayName: newPropName.trim(),
      baseType: newPropType,
      columnName: newPropColumn,
    });
    setNewPropName('');
    setNewPropType('string');
    setNewPropColumn(undefined);
    setIsAddModalOpen(false);
  };

  const columns = [
    {
      title: t('objectType.fields.displayName'),
      dataIndex: 'displayName',
      key: 'displayName',
      render: (val: string, record: WizardProperty) => (
        <Flex align="center" gap={4}>
          <Text>{val}</Text>
          {record.isPrimaryKey && <Tag color="blue">{t('objectType.properties.primaryKey')}</Tag>}
          {record.isTitleKey && <Tag color="green">{t('objectType.properties.titleKey')}</Tag>}
        </Flex>
      ),
    },
    {
      title: t('property.fields.baseType'),
      dataIndex: 'baseType',
      key: 'baseType',
      width: 140,
      render: (val: PropertyBaseType, record: WizardProperty) => (
        <Select
          size="small"
          value={val}
          onChange={(v) => updateProperty(record.id, { baseType: v })}
          options={BASE_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('objectType.properties.mappedColumn'),
      dataIndex: 'columnName',
      key: 'columnName',
      width: 160,
      render: (val: string | undefined, record: WizardProperty) => {
        if (datasetColumns.length === 0) {
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('objectType.properties.unmapped')}
            </Text>
          );
        }
        return (
          <Select
            size="small"
            value={val}
            onChange={(v) => updateProperty(record.id, { columnName: v })}
            placeholder={t('objectType.properties.mapToColumn')}
            options={datasetColumns.map((c) => ({ value: c.name, label: c.name }))}
            style={{ width: '100%' }}
            allowClear
          />
        );
      },
    },
    {
      title: 'PK',
      width: 50,
      render: (_: unknown, record: WizardProperty) => (
        <Tooltip title={t('objectType.properties.primaryKey')}>
          <input
            type="radio"
            name="primaryKey"
            checked={!!record.isPrimaryKey}
            onChange={() => {
              properties.forEach((p) => {
                if (p.id !== record.id && p.isPrimaryKey) {
                  updateProperty(p.id, { isPrimaryKey: false });
                }
              });
              updateProperty(record.id, { isPrimaryKey: true });
            }}
          />
        </Tooltip>
      ),
    },
    {
      title: 'TK',
      width: 50,
      render: (_: unknown, record: WizardProperty) => (
        <Tooltip title={t('objectType.properties.titleKey')}>
          <input
            type="radio"
            name="titleKey"
            checked={!!record.isTitleKey}
            onChange={() => {
              properties.forEach((p) => {
                if (p.id !== record.id && p.isTitleKey) {
                  updateProperty(p.id, { isTitleKey: false });
                }
              });
              updateProperty(record.id, { isTitleKey: true });
            }}
          />
        </Tooltip>
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, record: WizardProperty) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          disabled={record.isPrimaryKey}
          onClick={() => removeProperty(record.id)}
        />
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center">
        <Text type="secondary" style={{ fontSize: 12 }}>
          {properties.length > 0
            ? `${properties.length} ${t('property.addProperty').toLowerCase()}`
            : t('objectType.placeholders.propertiesEmpty')}
        </Text>
        <Flex gap={8}>
          {datasetColumns.length > 0 && (
            <Button size="small" onClick={handleAddAll}>
              {t('objectType.properties.addAll')}
            </Button>
          )}
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setIsAddModalOpen(true)}
          >
            {t('objectType.properties.addAsNew')}
          </Button>
        </Flex>
      </Flex>

      <Table
        dataSource={properties}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText: t('common.noData') }}
      />

      <Modal
        title={t('objectType.properties.addAsNew')}
        open={isAddModalOpen}
        onOk={handleAddManual}
        onCancel={() => setIsAddModalOpen(false)}
        okButtonProps={{ disabled: !newPropName.trim() }}
        destroyOnClose
      >
        <Flex vertical gap={12} style={{ marginTop: 16 }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('objectType.fields.displayName')}
            </Text>
            <Input
              value={newPropName}
              onChange={(e) => setNewPropName(e.target.value)}
              placeholder="Property Name"
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('property.fields.baseType')}
            </Text>
            <Select
              value={newPropType}
              onChange={setNewPropType}
              options={BASE_TYPE_OPTIONS.map((bt) => ({ value: bt, label: bt }))}
              style={{ width: '100%' }}
            />
          </div>
          {datasetColumns.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                {t('objectType.properties.mappedColumn')}
              </Text>
              <Select
                value={newPropColumn}
                onChange={setNewPropColumn}
                placeholder={t('objectType.properties.mapToColumn')}
                options={datasetColumns.map((c) => ({ value: c.name, label: c.name }))}
                style={{ width: '100%' }}
                allowClear
              />
            </div>
          )}
        </Flex>
      </Modal>
    </Flex>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Flex,
  Input,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

const { Option } = Select;
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateWizardStore } from '@/stores/create-wizard-store';
import { useDataset } from '@/api/datasets';
import type { WizardProperty } from '@/stores/create-wizard-store';
import type { PropertyBaseType } from '@/api/types';
import {
  sanitizePropertyApiName,
  isReservedPropertyApiName,
  isValidPropertyApiName,
} from '@/utils/naming';

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
  const {
    selectedDatasetRid,
    properties,
    addProperty,
    removeProperty,
    updateProperty,
    setProperties,
  } = useCreateWizardStore();

  const { data: dataset } = useDataset(selectedDatasetRid ?? '');
  const datasetColumns = dataset?.columns ?? [];

  // Auto-map dataset columns to properties on first load
  const autoMappedRef = useRef(false);
  useEffect(() => {
    if (
      datasetColumns.length > 0 &&
      properties.length === 0 &&
      !autoMappedRef.current
    ) {
      autoMappedRef.current = true;
      const mapped: WizardProperty[] = datasetColumns.map((col) => ({
        id: generateId(),
        displayName: col.name,
        baseType: col.inferredType || 'string',
        columnName: col.name,
      }));
      setProperties(mapped);
    }
  }, [datasetColumns, properties.length, setProperties]);

  // Inline add row state
  const [isAdding, setIsAdding] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<PropertyBaseType>('string');

  const handleAddInline = () => {
    if (!newPropName.trim()) return;
    addProperty({
      id: generateId(),
      displayName: newPropName.trim(),
      baseType: newPropType,
    });
    setNewPropName('');
    setNewPropType('string');
    setIsAdding(false);
  };

  // PK / TK selection
  const primaryKeyId = properties.find((p) => p.isPrimaryKey)?.id;
  const titleKeyId = properties.find((p) => p.isTitleKey)?.id;

  const handlePrimaryKeyChange = (propId?: string) => {
    const updated = properties.map((p) => ({
      ...p,
      isPrimaryKey: !!propId && p.id === propId,
    }));
    setProperties(updated);
  };

  const handleTitleKeyChange = (propId?: string) => {
    const updated = properties.map((p) => ({
      ...p,
      isTitleKey: !!propId && p.id === propId,
    }));
    setProperties(updated);
  };

  const columns = [
    {
      title: t('wizard.properties.source'),
      key: 'source',
      width: 160,
      render: (_: unknown, record: WizardProperty) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {record.columnName ?? t('wizard.properties.userInput')}
        </Text>
      ),
    },
    {
      title: '',
      key: 'baseType',
      width: 120,
      render: (_: unknown, record: WizardProperty) => (
        <Select
          size="small"
          value={record.baseType}
          onChange={(v) => updateProperty(record.id, { baseType: v })}
          options={BASE_TYPE_OPTIONS.map((bt) => ({ value: bt, label: bt }))}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('wizard.properties.property'),
      key: 'displayName',
      width: 220,
      render: (_: unknown, record: WizardProperty) => (
        <Flex align="center" gap={4}>
          <Input
            size="small"
            value={record.displayName}
            onChange={(e) =>
              updateProperty(record.id, { displayName: e.target.value })
            }
            style={{ width: 160 }}
          />
          {record.isPrimaryKey && (
            <Tag color="blue">{t('objectType.properties.primaryKey')}</Tag>
          )}
          {record.isTitleKey && (
            <Tag color="green">{t('objectType.properties.titleKey')}</Tag>
          )}
        </Flex>
      ),
    },
    {
      title: t('wizard.properties.apiNamePreview'),
      key: 'apiName',
      render: (_: unknown, record: WizardProperty) => {
        const apiName = sanitizePropertyApiName(record.displayName);
        const isReserved = isReservedPropertyApiName(apiName);
        const isInvalid = !isValidPropertyApiName(apiName);
        if (isReserved) {
          return (
            <Tooltip title={apiName}>
              <Tag color="error">{t('wizard.properties.apiNameReserved')}</Tag>
            </Tooltip>
          );
        }
        if (isInvalid) {
          return (
            <Tooltip title={apiName}>
              <Tag color="warning">{t('wizard.properties.apiNameInvalid')}</Tag>
            </Tooltip>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{apiName}</Text>;
      },
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
          onClick={() => removeProperty(record.id)}
        />
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      {/* PK / TK selectors */}
      <Flex gap={24}>
        <Flex align="center" gap={8}>
          <Text strong style={{ whiteSpace: 'nowrap' }}>
            {t('objectType.properties.primaryKey')}
          </Text>
          <Select
            size="small"
            value={primaryKeyId}
            onChange={handlePrimaryKeyChange}
            placeholder={t('wizard.properties.selectProperty')}
            style={{ width: 200 }}
            allowClear
          >
            {properties.map((p) => (
              <Option key={p.id} value={p.id}>{p.displayName}</Option>
            ))}
          </Select>
        </Flex>
        <Flex align="center" gap={8}>
          <Text strong style={{ whiteSpace: 'nowrap' }}>
            {t('objectType.properties.titleKey')}
          </Text>
          <Select
            size="small"
            value={titleKeyId}
            onChange={handleTitleKeyChange}
            placeholder={t('wizard.properties.selectProperty')}
            style={{ width: 200 }}
            allowClear
          >
            {properties.map((p) => (
              <Option key={p.id} value={p.id}>{p.displayName}</Option>
            ))}
          </Select>
        </Flex>
      </Flex>

      {/* Properties table */}
      <Table
        dataSource={properties}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText: t('common.noData') }}
      />

      {/* Inline add row */}
      {isAdding ? (
        <Flex gap={8} align="center" style={{ paddingLeft: 8 }}>
          <Input
            size="small"
            value={newPropName}
            onChange={(e) => setNewPropName(e.target.value)}
            placeholder={t('objectType.fields.displayName')}
            style={{ width: 180 }}
            autoFocus
            onPressEnter={handleAddInline}
          />
          <Select
            size="small"
            value={newPropType}
            onChange={setNewPropType}
            options={BASE_TYPE_OPTIONS.map((bt) => ({ value: bt, label: bt }))}
            style={{ width: 120 }}
          />
          <Button size="small" type="primary" onClick={handleAddInline}>
            {t('common.confirm')}
          </Button>
          <Button size="small" onClick={() => setIsAdding(false)}>
            {t('common.cancel')}
          </Button>
        </Flex>
      ) : (
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setIsAdding(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          {t('property.addProperty')}
        </Button>
      )}
    </Flex>
  );
}

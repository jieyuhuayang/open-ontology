import { Button, Input, Select, Space, Table } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { StructField } from '@/api/types';

const STRUCT_FIELD_TYPES = [
  'string',
  'integer',
  'long',
  'float',
  'double',
  'decimal',
  'boolean',
  'date',
  'timestamp',
  'byte',
  'short',
];

interface StructFieldEditorProps {
  value?: StructField[];
  onChange?: (fields: StructField[]) => void;
  disabled?: boolean;
}

export default function StructFieldEditor({
  value = [],
  onChange,
  disabled,
}: StructFieldEditorProps) {
  const { t } = useTranslation();

  const handleAddField = () => {
    onChange?.([...value, { name: '', type: 'string' }]);
  };

  const handleRemoveField = (index: number) => {
    onChange?.(value.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: Partial<StructField>) => {
    onChange?.(value.map((f, i) => (i === index ? { ...f, ...field } : f)));
  };

  const columns: ColumnsType<StructField & { _index: number }> = [
    {
      title: t('property.structField.fieldName'),
      key: 'name',
      render: (_, record) => (
        <Input
          value={record.name}
          onChange={(e) => handleFieldChange(record._index, { name: e.target.value })}
          disabled={disabled}
          placeholder={t('property.structField.fieldName')}
          size="small"
        />
      ),
    },
    {
      title: t('property.structField.fieldType'),
      key: 'type',
      width: 160,
      render: (_, record) => (
        <Select
          value={record.type}
          onChange={(v) => handleFieldChange(record._index, { type: v })}
          disabled={disabled}
          size="small"
          style={{ width: '100%' }}
          options={STRUCT_FIELD_TYPES.map((type) => ({
            value: type,
            label: t(`property.baseTypes.${type}`, type),
          }))}
        />
      ),
    },
    ...(!disabled
      ? [
          {
            title: '',
            key: 'action',
            width: 40,
            render: (_: unknown, record: StructField & { _index: number }) => (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveField(record._index)}
              />
            ),
          },
        ]
      : []),
  ];

  const dataSource = value.map((f, i) => ({ ...f, _index: i, _key: i }));

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="_key"
        size="small"
        pagination={false}
        locale={{ emptyText: t('property.empty') }}
      />
      {!disabled && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddField}
          size="small"
          block
        >
          {t('property.structField.addField')}
        </Button>
      )}
    </Space>
  );
}

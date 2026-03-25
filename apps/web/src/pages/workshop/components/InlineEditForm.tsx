import { Button, Form, Input, Select, Space, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUpdateItemDecision } from '@/api/blueprints';
import type { BlueprintItem } from '@/api/types';

interface InlineEditFormProps {
  item: BlueprintItem;
  blueprintRid: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function InlineEditForm({
  item,
  blueprintRid,
  onConfirm,
  onCancel,
}: InlineEditFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const decisionMutation = useUpdateItemDecision(blueprintRid);

  const suggestion = (item.userEdits ?? item.suggestion) as Record<
    string,
    unknown
  >;

  const handleSubmit = async () => {
    const values = await form.validateFields();
    decisionMutation.mutate(
      {
        itemRid: item.rid,
        userDecision: 'edited',
        userEdits: values,
      },
      { onSuccess: onConfirm },
    );
  };

  return (
    <div style={{ padding: '8px 12px' }}>
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={suggestion}
      >
        {item.itemType === 'object_type' && (
          <>
            <Form.Item label={t('common.displayName', 'Display Name')} name="displayName">
              <Input />
            </Form.Item>
            <Form.Item label="API Name" name="apiName">
              <Input />
            </Form.Item>
            <Form.Item label="Description" name="description">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Icon" name="icon">
              <Input />
            </Form.Item>
          </>
        )}
        {item.itemType === 'property' && (
          <>
            <Form.Item label={t('common.displayName', 'Display Name')} name="displayName">
              <Input />
            </Form.Item>
            <Form.Item label="API Name" name="apiName">
              <Input />
            </Form.Item>
            <Form.Item label="Base Type" name="baseType">
              <Select
                options={[
                  { label: 'String', value: 'string' },
                  { label: 'Integer', value: 'integer' },
                  { label: 'Float', value: 'float' },
                  { label: 'Boolean', value: 'boolean' },
                  { label: 'Datetime', value: 'datetime' },
                  { label: 'Array', value: 'array' },
                  { label: 'Object', value: 'object' },
                ]}
              />
            </Form.Item>
            <Space>
              <Form.Item
                label="Required"
                name="required"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="Primary Key"
                name="primaryKey"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Space>
          </>
        )}
        {item.itemType === 'link_type' && (
          <>
            <Form.Item label={t('common.displayName', 'Display Name')} name="displayName">
              <Input />
            </Form.Item>
            <Form.Item label="Side A">
              <Input
                value={
                  (
                    (suggestion.sideA as Record<string, unknown>)
                      ?.displayName as string
                  ) ?? '—'
                }
                disabled
              />
            </Form.Item>
            <Form.Item label="Side B">
              <Input
                value={
                  (
                    (suggestion.sideB as Record<string, unknown>)
                      ?.displayName as string
                  ) ?? '—'
                }
                disabled
              />
            </Form.Item>
            <Form.Item label="Cardinality" name="cardinality">
              <Select
                options={[
                  { label: 'One to One', value: 'one-to-one' },
                  { label: 'One to Many', value: 'one-to-many' },
                  { label: 'Many to Many', value: 'many-to-many' },
                ]}
              />
            </Form.Item>
          </>
        )}
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={handleSubmit}
            loading={decisionMutation.isPending}
          >
            {t('workshop.review.confirmEdit')}
          </Button>
          <Button size="small" onClick={onCancel}>
            {t('workshop.review.cancelEdit')}
          </Button>
        </Space>
      </Form>
    </div>
  );
}

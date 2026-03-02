import { useEffect } from 'react';
import { Drawer, Form, Input, Select, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateProperty } from '@/api/properties';
import PropertyTypeSelector from './PropertyTypeSelector';
import StructFieldEditor from './StructFieldEditor';
import type { StructField } from '@/api/types';

const PROPERTY_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const PROPERTY_API_NAME_PATTERN = /^[a-z][a-zA-Z0-9]{0,99}$/;

function toApiName(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .map((word, i) =>
      i === 0
        ? word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        : word.replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (c) => c.toUpperCase()),
    )
    .join('')
    .replace(/^[^a-z]/, (c) => c.toLowerCase()) || '';
}

interface CreatePropertyDrawerProps {
  open: boolean;
  objectTypeRid: string;
  onClose: () => void;
}

interface FormValues {
  displayName: string;
  id: string;
  apiName: string;
  baseType: string;
  arrayInnerType?: string;
  structSchema?: StructField[];
  backingColumn?: string;
  description?: string;
  status: string;
  visibility: string;
}

export default function CreatePropertyDrawer({
  open,
  objectTypeRid,
  onClose,
}: CreatePropertyDrawerProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const baseType = Form.useWatch('baseType', form);
  const createMutation = useCreateProperty(objectTypeRid);

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const apiName = form.getFieldValue('apiName') as string;
    // Only auto-fill apiName if it hasn't been manually edited
    if (!apiName || apiName === toApiName(form.getFieldValue('displayName') ?? '')) {
      form.setFieldValue('apiName', toApiName(val));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync({
        id: values.id,
        apiName: values.apiName,
        displayName: values.displayName,
        baseType: values.baseType,
        arrayInnerType: values.arrayInnerType ?? null,
        structSchema: values.structSchema ?? null,
        backingColumn: values.backingColumn || null,
        description: values.description || null,
        status: values.status as 'experimental' | 'active' | 'deprecated',
        visibility: values.visibility as 'prominent' | 'normal' | 'hidden',
      });
      void message.success(t('property.createSuccess'));
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr?.response?.data?.error?.message;
      if (msg) void message.error(msg);
    }
  };

  return (
    <Drawer
      title={t('property.addProperty')}
      open={open}
      onClose={onClose}
      width={480}
      footer={
        <div style={{ textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{ marginRight: 8 }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => void handleSubmit()}
          >
            {t('common.create')}
          </button>
        </div>
      }
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: 'experimental', visibility: 'normal' }}
      >
        <Form.Item
          name="displayName"
          label={t('property.fields.displayName')}
          rules={[{ required: true, message: t('property.validation.displayNameRequired') }]}
        >
          <Input onChange={handleDisplayNameChange} />
        </Form.Item>

        <Form.Item
          name="id"
          label={t('property.fields.id')}
          rules={[
            { required: true, message: t('property.validation.idRequired') },
            {
              validator: (_, value) =>
                !value || PROPERTY_ID_PATTERN.test(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('property.validation.idFormat'))),
            },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="apiName"
          label={t('property.fields.apiName')}
          rules={[
            { required: true, message: t('property.validation.apiNameRequired') },
            {
              validator: (_, value) =>
                !value || PROPERTY_API_NAME_PATTERN.test(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('property.validation.apiNameFormat'))),
            },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="baseType"
          label={t('property.fields.baseType')}
          rules={[{ required: true, message: t('property.validation.baseTypeRequired') }]}
        >
          <PropertyTypeSelector />
        </Form.Item>

        {baseType === 'array' && (
          <Form.Item
            name="arrayInnerType"
            label={t('property.arrayInnerType')}
            rules={[{ required: true, message: t('property.validation.arrayInnerTypeRequired') }]}
          >
            <PropertyTypeSelector />
          </Form.Item>
        )}

        {baseType === 'struct' && (
          <Form.Item name="structSchema" label={t('property.baseTypes.struct')}>
            <StructFieldEditor />
          </Form.Item>
        )}

        <Form.Item name="backingColumn" label={t('property.fields.backingColumn')}>
          <Input placeholder={t('property.backingColumn.columnPlaceholder')} />
        </Form.Item>

        <Form.Item name="description" label={t('property.fields.description')}>
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item name="status" label={t('property.fields.status')}>
          <Select
            options={[
              { value: 'experimental', label: t('objectType.status.experimental') },
              { value: 'active', label: t('objectType.status.active') },
              { value: 'deprecated', label: t('objectType.status.deprecated') },
            ]}
          />
        </Form.Item>

        <Form.Item name="visibility" label={t('property.fields.visibility')}>
          <Select
            options={[
              { value: 'prominent', label: t('objectType.visibility.prominent') },
              { value: 'normal', label: t('objectType.visibility.normal') },
              { value: 'hidden', label: t('objectType.visibility.hidden') },
            ]}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

import { useEffect } from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateWizardStore } from '@/stores/create-wizard-store';
import IconSelector from '@/components/IconSelector';
import { validateObjectTypeId, validateApiName } from '@/utils/validation';
import type { Icon } from '@/api/types';

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toApiName(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

interface FormValues {
  displayName: string;
  description?: string;
  objectTypeId: string;
  apiName: string;
  icon: Icon;
}

export default function WizardStepMetadata() {
  const { t } = useTranslation();
  const { displayName, description, icon, objectTypeId, setMetadata } = useCreateWizardStore();
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({
      displayName,
      description,
      icon,
      objectTypeId,
    });
  }, []);

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const kebab = toKebabCase(val);
    const api = toApiName(val);
    form.setFieldsValue({ objectTypeId: kebab, apiName: api });
    setMetadata({ displayName: val, objectTypeId: kebab });
  };

  const handleValuesChange = (_: Partial<FormValues>, all: FormValues) => {
    setMetadata({
      displayName: all.displayName,
      description: all.description ?? '',
      icon: all.icon,
      objectTypeId: all.objectTypeId,
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        displayName,
        description,
        icon: icon ?? { name: 'AppstoreOutlined', color: '#1677ff' },
        objectTypeId,
        apiName: '',
      }}
      onValuesChange={handleValuesChange}
    >
      <Form.Item name="icon" label={t('objectType.fields.icon')}>
        <IconSelector
          value={form.getFieldValue('icon') as Icon ?? { name: 'AppstoreOutlined', color: '#1677ff' }}
          onChange={(ic) => {
            form.setFieldsValue({ icon: ic });
            setMetadata({ icon: ic });
          }}
        />
      </Form.Item>

      <Form.Item
        name="displayName"
        label={t('objectType.fields.displayName')}
        rules={[{ required: true, message: t('objectType.validation.displayNameRequired') }]}
      >
        <Input onChange={handleDisplayNameChange} />
      </Form.Item>

      <Form.Item name="description" label={t('objectType.fields.description')}>
        <Input.TextArea rows={2} />
      </Form.Item>

      <Form.Item
        name="objectTypeId"
        label={t('objectType.fields.id')}
        rules={[
          { required: true, message: t('objectType.validation.displayNameRequired') },
          {
            validator: (_, val: string) => {
              const err = validateObjectTypeId(val);
              return err ? Promise.reject(t(`objectType.${err}`)) : Promise.resolve();
            },
          },
        ]}
        validateTrigger="onChange"
      >
        <Input placeholder="e.g. my-object-type" />
      </Form.Item>

      <Form.Item
        name="apiName"
        label={t('objectType.fields.apiName')}
        rules={[
          { required: true, message: t('objectType.validation.displayNameRequired') },
          {
            validator: (_, val: string) => {
              const err = validateApiName(val);
              return err ? Promise.reject(t(`objectType.${err}`)) : Promise.resolve();
            },
          },
        ]}
        validateTrigger="onChange"
      >
        <Input placeholder="e.g. MyObjectType" />
      </Form.Item>
    </Form>
  );
}

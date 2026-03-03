import { useEffect } from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateWizardStore } from '@/stores/create-wizard-store';
import IconSelector from '@/components/IconSelector';
import type { Icon } from '@/api/types';

interface FormValues {
  displayName: string;
  pluralDisplayName: string;
  description?: string;
  icon: Icon;
}

export default function WizardStepMetadata() {
  const { t } = useTranslation();
  const { displayName, pluralDisplayName, description, icon, setMetadata } =
    useCreateWizardStore();
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({
      displayName,
      pluralDisplayName,
      description,
      icon,
    });
  }, []);

  const handleValuesChange = (_: Partial<FormValues>, all: FormValues) => {
    setMetadata({
      displayName: all.displayName,
      pluralDisplayName: all.pluralDisplayName,
      description: all.description ?? '',
      icon: all.icon,
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        displayName,
        pluralDisplayName,
        description,
        icon: icon ?? { name: 'AppstoreOutlined', color: '#1677ff' },
      }}
      onValuesChange={handleValuesChange}
    >
      <Form.Item name="icon" label={t('objectType.fields.icon')}>
        <IconSelector
          value={
            (form.getFieldValue('icon') as Icon) ?? {
              name: 'AppstoreOutlined',
              color: '#1677ff',
            }
          }
          onChange={(ic) => {
            form.setFieldsValue({ icon: ic });
            setMetadata({ icon: ic });
          }}
        />
      </Form.Item>

      <Form.Item
        name="displayName"
        label={t('objectType.fields.displayName')}
        rules={[
          {
            required: true,
            message: t('objectType.validation.displayNameRequired'),
          },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item
        name="pluralDisplayName"
        label={t('objectType.fields.pluralDisplayName')}
      >
        <Input />
      </Form.Item>

      <Form.Item name="description" label={t('objectType.fields.description')}>
        <Input.TextArea rows={2} />
      </Form.Item>
    </Form>
  );
}

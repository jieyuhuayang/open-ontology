import { Modal, Form, Input, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreateObjectTypeModalStore } from '@/stores/create-object-type-modal-store';
import { useCreateObjectType } from '@/api/object-types';
import IconSelector from '@/components/IconSelector';
import { validateObjectTypeId, validateApiName } from '@/utils/validation';
import type { Icon } from '@/api/types';
import type { AxiosError } from 'axios';

interface FormValues {
  displayName: string;
  description?: string;
  id: string;
  apiName: string;
  icon: Icon;
}

interface ApiErrorResponse {
  error?: { code?: string; message?: string };
}

const ERROR_CODE_TO_FIELD: Record<string, { field: keyof FormValues; messageKey: string }> = {
  OBJECT_TYPE_ID_CONFLICT: { field: 'id', messageKey: 'objectType.validation.idConflict' },
  OBJECT_TYPE_API_NAME_CONFLICT: { field: 'apiName', messageKey: 'objectType.validation.apiNameConflict' },
  OBJECT_TYPE_RESERVED_API_NAME: { field: 'apiName', messageKey: 'objectType.validation.apiNameReserved' },
  OBJECT_TYPE_INVALID_ID: { field: 'id', messageKey: 'objectType.validation.idFormat' },
  OBJECT_TYPE_INVALID_API_NAME: { field: 'apiName', messageKey: 'objectType.validation.apiNameFormat' },
};

export default function CreateObjectTypeModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOpen, close } = useCreateObjectTypeModalStore();
  const createMutation = useCreateObjectType();
  const [form] = Form.useForm<FormValues>();

  const handleCancel = () => {
    form.resetFields();
    close();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const result = await createMutation.mutateAsync({
        id: values.id,
        apiName: values.apiName,
        displayName: values.displayName,
        description: values.description ?? null,
        icon: values.icon,
      });
      message.success(t('objectType.createSuccess'));
      form.resetFields();
      close();
      navigate(`/object-types/${result.rid}`);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const code = axiosErr.response?.data?.error?.code;
      if (code) {
        const mapping = ERROR_CODE_TO_FIELD[code];
        if (mapping) {
          form.setFields([{ name: mapping.field, errors: [t(mapping.messageKey)] }]);
          return;
        }
      }
      if (axiosErr.response) {
        message.error(axiosErr.response.data?.error?.message ?? t('error.somethingWentWrong'));
      }
    }
  };

  return (
    <Modal
      title={t('objectType.createTitle')}
      open={isOpen}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={t('common.create')}
      cancelText={t('common.cancel')}
      confirmLoading={createMutation.isPending}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          icon: { name: 'AppstoreOutlined', color: '#1677ff' },
        }}
      >
        <Form.Item name="icon" label={t('objectType.fields.icon')}>
          <IconSelector
            value={form.getFieldValue('icon') as Icon ?? { name: 'AppstoreOutlined', color: '#1677ff' }}
            onChange={(icon) => form.setFieldsValue({ icon })}
          />
        </Form.Item>

        <Form.Item
          name="displayName"
          label={t('objectType.fields.displayName')}
          rules={[{ required: true, message: t('objectType.validation.displayNameRequired') }]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="description" label={t('objectType.fields.description')}>
          <Input.TextArea rows={2} />
        </Form.Item>

        <Form.Item
          name="id"
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
    </Modal>
  );
}

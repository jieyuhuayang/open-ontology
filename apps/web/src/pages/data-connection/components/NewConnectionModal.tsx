import { Modal, Form, Input, InputNumber, Switch, Button, Space, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateMySQLConnection, useTestMySQLConnection } from '@/api/mysql-connections';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type { MySQLConnectionCreateRequest, MySQLConnectionTestRequest } from '@/api/types';
import { useState } from 'react';

export default function NewConnectionModal() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const openModal = useDataConnectionStore((s) => s.openModal);
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);

  const [form] = Form.useForm<MySQLConnectionCreateRequest>();
  const createConnection = useCreateMySQLConnection();
  const testConnection = useTestMySQLConnection();
  const [tested, setTested] = useState(false);

  const open = openModal === 'newConnection';

  const handleClose = () => {
    setOpenModal(null);
    form.resetFields();
    setTested(false);
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      const req: MySQLConnectionTestRequest = {
        host: values.host,
        port: values.port ?? 3306,
        databaseName: values.databaseName,
        username: values.username,
        password: values.password ?? '',
        sslEnabled: values.sslEnabled ?? false,
      };
      const result = await testConnection.mutateAsync(req);
      if (result.success) {
        message.success(t('mysqlConnection.testSuccess'));
        setTested(true);
      } else {
        message.error(t('mysqlConnection.testFailed', { error: result.error }));
      }
    } catch (err) {
      console.log('[handleTest] error:', err);
      // Show API errors (form validation errors are handled by Ant Design inline)
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(t('mysqlConnection.testFailed', { error: String(err) }));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await createConnection.mutateAsync({
        name: values.name,
        host: values.host,
        port: values.port ?? 3306,
        databaseName: values.databaseName,
        username: values.username,
        password: values.password ?? '',
        sslEnabled: values.sslEnabled ?? false,
      });
      message.success(t('dataConnection.saveSuccess'));
      handleClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(t('dataConnection.saveFailed', { error: String(err) }));
    }
  };

  return (
    <Modal
      open={open}
      title={t('dataConnection.newConnectionTitle')}
      onCancel={handleClose}
      footer={null}
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label={t('mysqlConnection.fields.name')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
          <Form.Item name="host" label={t('mysqlConnection.fields.host')} rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="localhost" />
          </Form.Item>
          <Form.Item name="port" label={t('mysqlConnection.fields.port')} initialValue={3306}>
            <InputNumber min={1} max={65535} style={{ width: 100 }} />
          </Form.Item>
        </Space>
        <Form.Item name="databaseName" label={t('mysqlConnection.fields.database')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="username" label={t('mysqlConnection.fields.username')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="password" label={t('mysqlConnection.fields.password')} rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="sslEnabled" label={t('mysqlConnection.fields.ssl')} valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
        <Space>
          <Button onClick={handleTest} loading={testConnection.isPending}>
            {t('mysqlConnection.testConnection')}
          </Button>
          <Button type="primary" onClick={handleSave} loading={createConnection.isPending} disabled={!tested}>
            {t('dataConnection.saveConnection')}
          </Button>
        </Space>
      </Form>
    </Modal>
  );
}

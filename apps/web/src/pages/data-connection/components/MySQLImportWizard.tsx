import { useState } from 'react';
import { Modal, Steps, Form, Input, InputNumber, Switch, Button, Table, Checkbox, Space, Result, Spin, App, Select, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useMySQLConnections,
  useCreateMySQLConnection,
  useTestMySQLConnection,
  useMySQLTables,
  useMySQLTableColumns,
} from '@/api/mysql-connections';
import { useMySQLImport, useImportTask } from '@/api/imports';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type { MySQLConnectionCreateRequest, MySQLConnectionTestRequest, MySQLTableInfo, MySQLColumnInfo } from '@/api/types';

const STEPS = ['connection', 'tables', 'config', 'result'] as const;

export default function MySQLImportWizard() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const openModal = useDataConnectionStore((s) => s.openModal);
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);

  const [step, setStep] = useState(0);
  const [connectionRid, setConnectionRid] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [datasetName, setDatasetName] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [useExisting, setUseExisting] = useState(false);

  const [form] = Form.useForm<MySQLConnectionCreateRequest>();

  const { data: existingConnections } = useMySQLConnections();
  const createConnection = useCreateMySQLConnection();
  const testConnection = useTestMySQLConnection();
  const { data: tables, isLoading: tablesLoading } = useMySQLTables(connectionRid ?? '');
  const { data: columns, isLoading: columnsLoading } = useMySQLTableColumns(connectionRid ?? '', selectedTable ?? '');
  const mysqlImport = useMySQLImport();
  const { data: taskData } = useImportTask(taskId ?? undefined);

  const open = openModal === 'mysqlImport';

  const handleClose = () => {
    setOpenModal(null);
    setStep(0);
    setConnectionRid(null);
    setSelectedTable(null);
    setSelectedColumns([]);
    setDatasetName('');
    setTaskId(null);
    setUseExisting(false);
    form.resetFields();
  };

  const handleTestAndSave = async () => {
    try {
      const values = await form.validateFields();

      // Test connection first
      const testReq: MySQLConnectionTestRequest = {
        host: values.host,
        port: values.port ?? 3306,
        databaseName: values.databaseName ?? values.database_name,
        username: values.username,
        password: values.password,
      };
      const testResult = await testConnection.mutateAsync(testReq);
      if (!testResult.success) {
        message.error(t('mysqlConnection.testFailed', { error: testResult.error }));
        return;
      }
      message.success(t('mysqlConnection.testSuccess'));

      // Save connection
      const conn = await createConnection.mutateAsync({
        name: values.name,
        host: values.host,
        port: values.port ?? 3306,
        databaseName: values.databaseName ?? values.database_name,
        username: values.username,
        password: values.password ?? '',
        sslEnabled: values.sslEnabled ?? false,
      });
      setConnectionRid(conn.rid);
      setStep(1);
    } catch {
      // form validation or API error
    }
  };

  const handleSelectExisting = (rid: string) => {
    setConnectionRid(rid);
    setStep(1);
  };

  const handleSelectTable = (table: string) => {
    setSelectedTable(table);
    setDatasetName(table);
    setStep(2);
  };

  const handleStartImport = async () => {
    if (!connectionRid || !selectedTable) return;
    try {
      const task = await mysqlImport.mutateAsync({
        connectionRid,
        table: selectedTable,
        datasetName: datasetName || selectedTable,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : undefined,
      });
      setTaskId(task.taskId);
      setStep(3);
    } catch {
      message.error(t('mysqlConnection.importFailed'));
    }
  };

  const renderStep0 = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type={useExisting ? 'default' : 'primary'} onClick={() => setUseExisting(false)} style={{ marginRight: 8 }}>
          {t('dataConnection.newConnection')}
        </Button>
        <Button type={useExisting ? 'primary' : 'default'} onClick={() => setUseExisting(true)}>
          {t('mysqlConnection.useExisting')}
        </Button>
      </div>

      {useExisting ? (
        <Select
          style={{ width: '100%' }}
          placeholder={t('mysqlConnection.useExisting')}
          onChange={handleSelectExisting}
          options={existingConnections?.map((c) => ({ label: `${c.name} (${c.host}:${c.port}/${c.databaseName})`, value: c.rid }))}
        />
      ) : (
        <Form form={form} layout="vertical">
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
          <Button
            type="primary"
            onClick={handleTestAndSave}
            loading={testConnection.isPending || createConnection.isPending}
          >
            {t('mysqlConnection.testConnection')} & {t('common.save')}
          </Button>
        </Form>
      )}
    </div>
  );

  const renderStep1 = () => (
    <div>
      {tablesLoading ? (
        <Spin />
      ) : (
        <Table<MySQLTableInfo>
          rowKey="name"
          dataSource={tables ?? []}
          pagination={false}
          onRow={(record) => ({ onClick: () => handleSelectTable(record.name), style: { cursor: 'pointer' } })}
          columns={[
            { title: t('mysqlConnection.fields.name'), dataIndex: 'name', key: 'name' },
            {
              title: t('mysqlConnection.estimatedRows'),
              dataIndex: 'rowCount',
              key: 'rowCount',
              render: (v: number) => v?.toLocaleString() ?? '—',
            },
          ]}
        />
      )}
    </div>
  );

  const renderStep2 = () => (
    <div>
      <Form layout="vertical">
        <Form.Item label={t('mysqlConnection.datasetName')}>
          <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
        </Form.Item>
        <Form.Item label={t('mysqlConnection.selectColumns')}>
          {columnsLoading ? (
            <Spin />
          ) : (
            <Checkbox.Group
              value={selectedColumns}
              onChange={(vals) => setSelectedColumns(vals as string[])}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {columns?.map((col: MySQLColumnInfo) => (
                <Checkbox key={col.name} value={col.name}>
                  {col.name} <Tag>{col.dataType}</Tag>
                  {col.isPrimaryKey && <Tag color="gold">PK</Tag>}
                </Checkbox>
              ))}
            </Checkbox.Group>
          )}
        </Form.Item>
      </Form>
      <Button type="primary" onClick={handleStartImport} loading={mysqlImport.isPending}>
        {t('mysqlConnection.confirmImport')}
      </Button>
    </div>
  );

  const renderStep3 = () => {
    if (!taskData) return <Spin />;
    if (taskData.status === 'pending' || taskData.status === 'running') {
      return (
        <Result
          icon={<Spin size="large" />}
          title={t(`import.status.${taskData.status}`)}
        />
      );
    }
    if (taskData.status === 'completed') {
      return (
        <Result
          status="success"
          title={t('mysqlConnection.importSuccess')}
          subTitle={`${taskData.rowCount?.toLocaleString()} ${t('import.rows')}, ${taskData.columnCount} ${t('import.columns')}`}
          extra={<Button type="primary" onClick={handleClose}>{t('common.confirm')}</Button>}
        />
      );
    }
    return (
      <Result
        status="error"
        title={t('mysqlConnection.importFailed')}
        subTitle={taskData.errorMessage}
        extra={<Button onClick={handleClose}>{t('common.confirm')}</Button>}
      />
    );
  };

  return (
    <Modal
      open={open}
      title={t('mysqlConnection.title')}
      onCancel={handleClose}
      footer={null}
      width={720}
      destroyOnClose
    >
      <Steps
        current={step}
        items={STEPS.map((s) => ({ title: t(`mysqlConnection.steps.${s}`) }))}
        style={{ marginBottom: 24 }}
      />
      {step === 0 && renderStep0()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </Modal>
  );
}

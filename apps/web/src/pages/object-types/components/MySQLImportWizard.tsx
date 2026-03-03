import { useState } from 'react';
import {
  Modal,
  Steps,
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Select,
  Table,
  Checkbox,
  Flex,
  Typography,
  Alert,
  Spin,
  message,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useMySQLConnections,
  useCreateMySQLConnection,
  useTestMySQLConnection,
  useMySQLTables,
  useMySQLTableColumns,
  useMySQLTablePreview,
} from '@/api/mysql-connections';
import { useMySQLImport } from '@/api/imports';
import { useImportTask } from '@/api/imports';
import { datasetKeys } from '@/api/datasets';
import { useQueryClient } from '@tanstack/react-query';
import type { MySQLConnectionCreateRequest } from '@/api/types';

const { Text, Title } = Typography;

interface MySQLImportWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (datasetRid: string) => void;
}

interface ConnectionFormValues {
  name: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  sslEnabled: boolean;
}

export default function MySQLImportWizard({ open, onClose, onSuccess }: MySQLImportWizardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [connForm] = Form.useForm<ConnectionFormValues>();
  const [selectedConnectionRid, setSelectedConnectionRid] = useState<string | undefined>();
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | undefined>();

  const { data: connections } = useMySQLConnections();
  const createConn = useCreateMySQLConnection();
  const testConn = useTestMySQLConnection();
  const mysqlImport = useMySQLImport();

  const activeConnRid = selectedConnectionRid ?? '';
  const { data: tables } = useMySQLTables(activeConnRid);
  const { data: tableColumns } = useMySQLTableColumns(activeConnRid, selectedTable);
  const { data: tablePreview } = useMySQLTablePreview(activeConnRid, selectedTable);
  const { data: importTask } = useImportTask(taskId);

  const handleClose = () => {
    setCurrentStep(0);
    setSelectedConnectionRid(undefined);
    setTestStatus('idle');
    setSelectedTable('');
    setDatasetName('');
    setSelectedColumns([]);
    setTaskId(undefined);
    connForm.resetFields();
    onClose();
  };

  const handleTestConnection = async () => {
    try {
      const values = connForm.getFieldsValue();
      await testConn.mutateAsync({
        host: values.host,
        port: values.port ?? 3306,
        databaseName: values.databaseName,
        username: values.username,
        password: values.password,
        sslEnabled: values.sslEnabled ?? false,
      });
      setTestStatus('success');
      setTestError('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message ?? 'Connection failed';
      setTestStatus('failed');
      setTestError(msg);
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      // Save connection if using form input
      if (!selectedConnectionRid) {
        try {
          const values = await connForm.validateFields();
          const conn = await createConn.mutateAsync({
            name: values.name,
            host: values.host,
            port: values.port ?? 3306,
            databaseName: values.databaseName,
            username: values.username,
            password: values.password,
            sslEnabled: values.sslEnabled ?? false,
          } as MySQLConnectionCreateRequest);
          setSelectedConnectionRid(conn.rid);
        } catch {
          return;
        }
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!selectedTable) return;
      // Pre-populate dataset name and select all columns
      setDatasetName(selectedTable);
      if (tableColumns) {
        setSelectedColumns(tableColumns.map((c) => c.name));
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Start import
      try {
        const task = await mysqlImport.mutateAsync({
          connectionRid: activeConnRid,
          tableName: selectedTable,
          datasetName,
          selectedColumns: selectedColumns.length > 0 ? selectedColumns : undefined,
        });
        setTaskId(task.taskId);
        setCurrentStep(3);
      } catch {
        message.error(t('mysqlConnection.importFailed'));
      }
    }
  };

  const handleUseDataset = () => {
    if (importTask?.datasetRid) {
      queryClient.invalidateQueries({ queryKey: datasetKeys.lists() });
      onSuccess(importTask.datasetRid);
      handleClose();
    }
  };

  const isNextDisabled =
    (currentStep === 0 && !selectedConnectionRid && testStatus !== 'success') ||
    (currentStep === 1 && !selectedTable) ||
    (currentStep === 2 && (!datasetName || selectedColumns.length === 0));

  const primaryKeyColumn = tableColumns?.find((c) => c.isPrimaryKey)?.name;

  const previewColumns = tablePreview?.columns.map((col) => ({
    title: col.name,
    dataIndex: col.name,
    key: col.name,
    width: 120,
    ellipsis: true,
  })) ?? [];

  const columnCheckOptions = tableColumns?.map((col) => ({
    label: `${col.name} (${col.dataType})${col.isPrimaryKey ? ' *' : ''}`,
    value: col.name,
    disabled: col.isPrimaryKey,
  })) ?? [];

  return (
    <Modal
      title={t('mysqlConnection.title')}
      open={open}
      onCancel={handleClose}
      width={760}
      destroyOnClose
      footer={
        currentStep < 3 ? (
          <Flex justify="space-between">
            <Button onClick={currentStep === 0 ? handleClose : () => setCurrentStep((s) => s - 1)}>
              {currentStep === 0 ? t('common.cancel') : t('wizard.back')}
            </Button>
            <Button
              type="primary"
              onClick={handleNext}
              disabled={isNextDisabled}
              loading={createConn.isPending || mysqlImport.isPending}
            >
              {currentStep === 2 ? t('mysqlConnection.confirmImport') : t('wizard.next')}
            </Button>
          </Flex>
        ) : null
      }
    >
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: t('mysqlConnection.steps.connection') },
          { title: t('mysqlConnection.steps.tables') },
          { title: t('mysqlConnection.steps.config') },
          { title: t('mysqlConnection.steps.result') },
        ]}
      />

      {currentStep === 0 && (
        <Flex vertical gap={16}>
          {connections && connections.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('mysqlConnection.useExisting')}
              </Text>
              <Select
                placeholder={t('mysqlConnection.useExisting')}
                value={selectedConnectionRid}
                onChange={(v) => {
                  setSelectedConnectionRid(v);
                  setTestStatus('idle');
                }}
                allowClear
                style={{ width: '100%' }}
                options={connections.map((c) => ({ value: c.rid, label: c.name }))}
              />
            </div>
          )}

          {!selectedConnectionRid && (
            <Form form={connForm} layout="vertical">
              <Form.Item name="name" label={t('mysqlConnection.fields.name')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Flex gap={12}>
                <Form.Item name="host" label={t('mysqlConnection.fields.host')} rules={[{ required: true }]} style={{ flex: 3 }}>
                  <Input placeholder="localhost" />
                </Form.Item>
                <Form.Item name="port" label={t('mysqlConnection.fields.port')} style={{ flex: 1 }}>
                  <InputNumber min={1} max={65535} defaultValue={3306} style={{ width: '100%' }} />
                </Form.Item>
              </Flex>
              <Form.Item name="database" label={t('mysqlConnection.fields.database')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Flex gap={12}>
                <Form.Item name="username" label={t('mysqlConnection.fields.username')} rules={[{ required: true }]} style={{ flex: 1 }}>
                  <Input />
                </Form.Item>
                <Form.Item name="password" label={t('mysqlConnection.fields.password')} style={{ flex: 1 }}>
                  <Input.Password />
                </Form.Item>
              </Flex>
              <Form.Item name="ssl" label={t('mysqlConnection.fields.ssl')} valuePropName="checked">
                <Switch />
              </Form.Item>

              <Flex align="center" gap={12}>
                <Button
                  onClick={handleTestConnection}
                  loading={testConn.isPending}
                >
                  {t('mysqlConnection.testConnection')}
                </Button>
                {testStatus === 'success' && (
                  <Flex align="center" gap={4}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text style={{ color: '#52c41a' }}>{t('mysqlConnection.testSuccess')}</Text>
                  </Flex>
                )}
                {testStatus === 'failed' && (
                  <Flex align="center" gap={4}>
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                    <Text style={{ color: '#ff4d4f' }}>
                      {t('mysqlConnection.testFailed', { error: testError })}
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Form>
          )}
        </Flex>
      )}

      {currentStep === 1 && (
        <Flex gap={16} style={{ height: 360 }}>
          <div style={{ width: 200, borderRight: '1px solid #f0f0f0', paddingRight: 16, overflowY: 'auto' }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('mysqlConnection.browseTable')}
            </Text>
            {tables?.map((tbl) => (
              <div
                key={tbl.name}
                onClick={() => setSelectedTable(tbl.name)}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  background: selectedTable === tbl.name ? '#e6f4ff' : 'transparent',
                  fontWeight: selectedTable === tbl.name ? 600 : 400,
                }}
              >
                {tbl.name}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedTable && tablePreview && (
              <>
                <Table
                  dataSource={tablePreview.rows.slice(0, 10)}
                  columns={previewColumns}
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  rowKey={(_, i) => String(i)}
                />
              </>
            )}
            {selectedTable && !tablePreview && (
              <Flex justify="center" align="center" style={{ height: '100%' }}>
                <Spin />
              </Flex>
            )}
          </div>
        </Flex>
      )}

      {currentStep === 2 && (
        <Flex vertical gap={16}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('mysqlConnection.datasetName')}
            </Text>
            <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('mysqlConnection.selectColumns')}
            </Text>
            <Checkbox.Group
              value={selectedColumns}
              onChange={(vals) => {
                // Keep primary key always selected
                const withPK = primaryKeyColumn
                  ? [...new Set([primaryKeyColumn, ...vals.map(String)])]
                  : vals.map(String);
                setSelectedColumns(withPK);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {columnCheckOptions.map((opt) => (
                <Checkbox key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>
          <Alert type="info" message={t('mysqlConnection.snapshotNote')} showIcon />
        </Flex>
      )}

      {currentStep === 3 && (
        <Flex vertical align="center" gap={16} style={{ padding: '24px 0' }}>
          {!importTask || importTask.status === 'pending' || importTask.status === 'running' ? (
            <>
              <Spin size="large" />
              <Text>{t('import.status.running')}</Text>
            </>
          ) : importTask.status === 'completed' ? (
            <>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
              <Title level={4}>{t('mysqlConnection.importSuccess')}</Title>
              {importTask.rowCount && (
                <Text type="secondary">
                  {importTask.rowCount} {t('import.rows')} · {importTask.columnCount} {t('import.columns')}
                </Text>
              )}
              <Button type="primary" onClick={handleUseDataset}>
                {t('import.useDataset')}
              </Button>
            </>
          ) : (
            <>
              <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
              <Title level={4}>{t('mysqlConnection.importFailed')}</Title>
              {importTask.errorMessage && (
                <Text type="danger">{importTask.errorMessage}</Text>
              )}
              <Flex gap={8}>
                <Button onClick={() => { setTaskId(undefined); setCurrentStep(2); }}>
                  {t('import.retry')}
                </Button>
                <Button onClick={handleClose}>{t('common.cancel')}</Button>
              </Flex>
            </>
          )}
        </Flex>
      )}
    </Modal>
  );
}

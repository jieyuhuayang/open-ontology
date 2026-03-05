import { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  Steps,
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Table,
  Checkbox,
  Space,
  Result,
  Spin,
  App,
  Select,
  Tag,
  Alert,
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useMySQLConnections,
  useCreateMySQLConnection,
  useTestMySQLConnection,
  useMySQLTables,
  useMySQLTableColumns,
  useMySQLImportedTables,
  useMySQLTablePreview,
} from '@/api/mysql-connections';
import { useMySQLImport, useImportTask } from '@/api/imports';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type {
  MySQLConnectionCreateRequest,
  MySQLConnectionTestRequest,
  MySQLTableInfo,
  MySQLColumnInfo,
} from '@/api/types';

const STEPS = ['connection', 'tables', 'config', 'result'] as const;

export default function MySQLImportWizard() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const openModal = useDataConnectionStore((s) => s.openModal);
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);

  const [step, setStep] = useState(0);
  const [connectionRid, setConnectionRid] = useState<string | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [selectedTableRowCount, setSelectedTableRowCount] = useState<number | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [columnsInitialized, setColumnsInitialized] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');

  const [form] = Form.useForm<MySQLConnectionCreateRequest>();
  const [useExisting, setUseExisting] = useState(false);

  const { data: existingConnections } = useMySQLConnections();
  const createConnection = useCreateMySQLConnection();
  const testConnection = useTestMySQLConnection();
  const { data: tables, isLoading: tablesLoading } = useMySQLTables(connectionRid ?? '');
  const { data: columns, isLoading: columnsLoading } = useMySQLTableColumns(
    connectionRid ?? '',
    selectedTableName ?? '',
  );
  const { data: importedTables } = useMySQLImportedTables(connectionRid ?? '');
  const { data: tablePreview, isLoading: previewLoading } = useMySQLTablePreview(
    connectionRid ?? '',
    selectedTableName ?? '',
  );
  const mysqlImport = useMySQLImport();
  const { data: taskData } = useImportTask(taskId ?? undefined);

  const open = openModal === 'mysqlImport';

  const importedTableSet = useMemo(() => new Set(importedTables ?? []), [importedTables]);

  const filteredTables = useMemo(() => {
    if (!tables) return [];
    if (!tableSearch) return tables;
    const lower = tableSearch.toLowerCase();
    return tables.filter((tbl) => tbl.name.toLowerCase().includes(lower));
  }, [tables, tableSearch]);

  // When columns load, default all columns to selected
  useEffect(() => {
    if (columns && columns.length > 0 && !columnsInitialized) {
      setSelectedColumns(columns.map((c) => c.name));
      setColumnsInitialized(true);
    }
  }, [columns, columnsInitialized]);

  const handleClose = () => {
    setOpenModal(null);
    setStep(0);
    setConnectionRid(null);
    setSelectedTableName(null);
    setSelectedTableRowCount(null);
    setSelectedColumns([]);
    setColumnsInitialized(false);
    setDatasetName('');
    setTaskId(null);
    setTableSearch('');
    setUseExisting(false);
    form.resetFields();
  };

  const handleSelectExisting = (rid: string) => {
    const conn = existingConnections?.find((c) => c.rid === rid);
    if (conn) {
      form.setFieldsValue({
        name: conn.name,
        host: conn.host,
        port: conn.port,
        databaseName: conn.databaseName,
        username: conn.username,
        sslEnabled: conn.sslEnabled,
      });
      setConnectionRid(rid);
    }
  };

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      const req: MySQLConnectionTestRequest = {
        host: values.host,
        port: values.port ?? 3306,
        databaseName: values.databaseName,
        username: values.username,
        password: values.password ?? '',
        sslEnabled: values.sslEnabled ?? false,
        connectionRid: connectionRid ?? undefined,
      };
      const result = await testConnection.mutateAsync(req);
      if (result.success) {
        message.success(t('mysqlConnection.testSuccess'));
      } else {
        message.error(t('mysqlConnection.testFailed', { error: result.error }));
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(t('mysqlConnection.testFailed', { error: String(err) }));
    }
  };

  const handleStep0Next = async () => {
    try {
      const values = await form.validateFields();
      // If using existing connection, just go next
      if (connectionRid && useExisting) {
        setStep(1);
        return;
      }
      // Otherwise test + save new connection
      const testReq: MySQLConnectionTestRequest = {
        host: values.host,
        port: values.port ?? 3306,
        databaseName: values.databaseName,
        username: values.username,
        password: values.password ?? '',
        sslEnabled: values.sslEnabled ?? false,
      };
      const testResult = await testConnection.mutateAsync(testReq);
      if (!testResult.success) {
        message.error(t('mysqlConnection.testFailed', { error: testResult.error }));
        return;
      }
      const conn = await createConnection.mutateAsync({
        name: values.name,
        host: values.host,
        port: values.port ?? 3306,
        databaseName: values.databaseName,
        username: values.username,
        password: values.password ?? '',
        sslEnabled: values.sslEnabled ?? false,
      });
      setConnectionRid(conn.rid);
      setStep(1);
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(t('mysqlConnection.saveFailed'));
    }
  };

  const handleSelectTable = (table: MySQLTableInfo) => {
    setSelectedTableName(table.name);
    setSelectedTableRowCount(table.rowCount ?? null);
    setDatasetName(table.name);
    setColumnsInitialized(false);
    setSelectedColumns([]);
  };

  const handleStep1Next = () => {
    if (selectedTableName) setStep(2);
  };

  const handleColumnToggle = (checkedValues: string[]) => {
    if (!columns) {
      setSelectedColumns(checkedValues);
      return;
    }
    // Ensure PK columns cannot be unchecked
    const pkNames = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
    const merged = new Set(checkedValues);
    for (const pk of pkNames) merged.add(pk);
    setSelectedColumns([...merged]);
  };

  const handleStartImport = async () => {
    if (!connectionRid || !selectedTableName) return;
    try {
      const task = await mysqlImport.mutateAsync({
        connectionRid,
        table: selectedTableName,
        datasetName: datasetName || selectedTableName,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : undefined,
      });
      setTaskId(task.taskId);
      setStep(3);
    } catch {
      message.error(t('mysqlConnection.importFailed'));
    }
  };

  const handleRetry = () => {
    setTaskId(null);
    setStep(2);
  };

  // --- Step renderers ---

  const renderStep0 = () => {
    const hasExisting = existingConnections && existingConnections.length > 0;
    return (
      <div>
        {hasExisting && (
          <div style={{ marginBottom: 16 }}>
            <Button
              type={useExisting ? 'default' : 'primary'}
              onClick={() => setUseExisting(false)}
              style={{ marginRight: 8 }}
            >
              {t('dataConnection.newConnection')}
            </Button>
            <Button
              type={useExisting ? 'primary' : 'default'}
              onClick={() => setUseExisting(true)}
            >
              {t('mysqlConnection.useExisting')}
            </Button>
          </div>
        )}

        {useExisting ? (
          <div>
            <Select
              style={{ width: '100%', marginBottom: 16 }}
              placeholder={t('mysqlConnection.selectConnection')}
              onChange={handleSelectExisting}
              options={existingConnections?.map((c) => ({
                label: `${c.name} (${c.host}:${c.port}/${c.databaseName})`,
                value: c.rid,
              }))}
            />
            <Form form={form} layout="vertical" style={{ display: 'none' }} />
            <Button type="primary" disabled={!connectionRid} onClick={handleStep0Next}>
              {t('wizard.next')}
            </Button>
          </div>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label={t('mysqlConnection.fields.name')}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
              <Form.Item
                name="host"
                label={t('mysqlConnection.fields.host')}
                rules={[{ required: true }]}
                style={{ flex: 1 }}
              >
                <Input placeholder="localhost" />
              </Form.Item>
              <Form.Item
                name="port"
                label={t('mysqlConnection.fields.port')}
                initialValue={3306}
              >
                <InputNumber min={1} max={65535} style={{ width: 100 }} />
              </Form.Item>
            </Space>
            <Form.Item
              name="databaseName"
              label={t('mysqlConnection.fields.database')}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="username"
              label={t('mysqlConnection.fields.username')}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="password"
              label={t('mysqlConnection.fields.password')}
              rules={[{ required: true }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="sslEnabled"
              label={t('mysqlConnection.fields.ssl')}
              valuePropName="checked"
              initialValue={false}
            >
              <Switch />
            </Form.Item>
            <Space>
              <Button onClick={handleTestConnection} loading={testConnection.isPending}>
                {t('mysqlConnection.testConnection')}
              </Button>
              <Button
                type="primary"
                onClick={handleStep0Next}
                loading={createConnection.isPending}
              >
                {t('wizard.next')}
              </Button>
            </Space>
          </Form>
        )}
      </div>
    );
  };

  const renderStep1 = () => {
    const previewColumns =
      tablePreview?.columns?.map((col: MySQLColumnInfo) => ({
        title: (
          <Space size={4}>
            {col.name}
            {col.isPrimaryKey && <Tag color="gold">PK</Tag>}
          </Space>
        ),
        dataIndex: col.name,
        key: col.name,
        ellipsis: true,
      })) ?? [];

    return (
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left pane: table list */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <Input.Search
            placeholder={t('mysqlConnection.searchTables')}
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            allowClear
            style={{ marginBottom: 8 }}
            size="small"
          />
          {tablesLoading ? (
            <Spin />
          ) : (
            <div
              style={{
                maxHeight: 400,
                overflowY: 'auto',
                border: '1px solid #f0f0f0',
                borderRadius: 6,
              }}
            >
              {filteredTables.map((tbl) => (
                <div
                  key={tbl.name}
                  onClick={() => handleSelectTable(tbl)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: selectedTableName === tbl.name ? '#e6f4ff' : undefined,
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Space size={4}>
                    <span>{tbl.name}</span>
                    {importedTableSet.has(tbl.name) && (
                      <Tag color="orange" style={{ marginRight: 0 }}>
                        {t('mysqlConnection.snapshotExists')}
                      </Tag>
                    )}
                  </Space>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    {tbl.rowCount?.toLocaleString() ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right pane: column structure + preview */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedTableName ? (
            <>
              <h4 style={{ marginTop: 0 }}>{t('dataConnection.tableStructure')}</h4>
              {columnsLoading ? (
                <Spin />
              ) : (
                <Table<MySQLColumnInfo>
                  rowKey="name"
                  dataSource={columns ?? []}
                  pagination={false}
                  size="small"
                  style={{ marginBottom: 16 }}
                  columns={[
                    { title: t('mysqlConnection.fields.name'), dataIndex: 'name', key: 'name' },
                    { title: t('mysqlConnection.fields.dataType'), dataIndex: 'dataType', key: 'dataType' },
                    {
                      title: 'PK',
                      dataIndex: 'isPrimaryKey',
                      key: 'pk',
                      width: 60,
                      render: (v: boolean) => (v ? <Tag color="gold">PK</Tag> : null),
                    },
                    {
                      title: 'Nullable',
                      dataIndex: 'isNullable',
                      key: 'nullable',
                      width: 80,
                      render: (v: boolean) => (v ? 'NULL' : 'NOT NULL'),
                    },
                  ]}
                />
              )}
              <h4>{t('dataConnection.tablePreview')}</h4>
              {previewLoading ? (
                <Spin />
              ) : (
                <Table
                  rowKey={(_, index) => String(index)}
                  columns={previewColumns}
                  dataSource={tablePreview?.rows ?? []}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  size="small"
                />
              )}
            </>
          ) : (
            <div style={{ color: '#999', paddingTop: 80, textAlign: 'center' }}>
              {t('mysqlConnection.browseTable')}
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setStep(0)}>{t('wizard.back')}</Button>
            <Button type="primary" disabled={!selectedTableName} onClick={handleStep1Next}>
              {t('wizard.next')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <div>
      <Form layout="vertical">
        <Form.Item label={t('mysqlConnection.datasetName')}>
          <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
        </Form.Item>
        {selectedTableRowCount != null && (
          <Form.Item label={t('mysqlConnection.estimatedRows')}>
            <span>{selectedTableRowCount.toLocaleString()}</span>
          </Form.Item>
        )}
        <Form.Item label={t('mysqlConnection.selectColumns')}>
          {columnsLoading ? (
            <Spin />
          ) : (
            <Checkbox.Group
              value={selectedColumns}
              onChange={(vals) => handleColumnToggle(vals as string[])}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {columns?.map((col: MySQLColumnInfo) => (
                <Checkbox key={col.name} value={col.name} disabled={col.isPrimaryKey}>
                  {col.name} <Tag>{col.dataType}</Tag>
                  {col.isPrimaryKey && <Tag color="gold">PK</Tag>}
                </Checkbox>
              ))}
            </Checkbox.Group>
          )}
        </Form.Item>
      </Form>
      <Alert
        type="info"
        showIcon
        message={t('mysqlConnection.snapshotWarning')}
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          onClick={() => {
            setStep(1);
            setColumnsInitialized(false);
            setSelectedColumns([]);
          }}
        >
          {t('wizard.back')}
        </Button>
        <Button type="primary" onClick={handleStartImport} loading={mysqlImport.isPending}>
          {t('mysqlConnection.confirmImport')}
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    if (!taskData) return <Spin />;
    if (taskData.status === 'pending' || taskData.status === 'running') {
      return (
        <Result icon={<Spin size="large" />} title={t(`import.status.${taskData.status}`)} />
      );
    }
    if (taskData.status === 'completed') {
      return (
        <Result
          status="success"
          title={t('mysqlConnection.importSuccess')}
          subTitle={`${taskData.rowCount?.toLocaleString()} ${t('import.rows')}, ${taskData.columnCount} ${t('import.columns')}`}
          extra={
            <Button type="primary" onClick={handleClose}>
              {t('import.done')}
            </Button>
          }
        />
      );
    }
    return (
      <Result
        status="error"
        title={t('mysqlConnection.importFailed')}
        subTitle={taskData.errorMessage}
        extra={
          <Space>
            <Button onClick={handleRetry}>{t('import.retry')}</Button>
            <Button onClick={handleClose}>{t('common.cancel')}</Button>
          </Space>
        }
      />
    );
  };

  return (
    <Modal
      open={open}
      title={t('mysqlConnection.title')}
      onCancel={handleClose}
      footer={null}
      width={step === 1 ? 900 : 720}
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

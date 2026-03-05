import { useState, useMemo } from 'react';
import {
  Modal,
  Steps,
  Form,
  Input,
  Button,
  Table,
  Checkbox,
  Space,
  Result,
  Spin,
  App,
  Select,
  Tag,
  Empty,
  Alert,
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useMySQLConnections,
  useMySQLTables,
  useMySQLTableColumns,
  useMySQLImportedTables,
} from '@/api/mysql-connections';
import { useMySQLImport, useImportTask } from '@/api/imports';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type { MySQLTableInfo, MySQLColumnInfo } from '@/api/types';

const STEPS = ['connection', 'tables', 'config', 'result'] as const;

export default function MySQLImportWizard() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const openModal = useDataConnectionStore((s) => s.openModal);
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);

  const [step, setStep] = useState(0);
  const [connectionRid, setConnectionRid] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<MySQLTableInfo | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [datasetName, setDatasetName] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');

  const { data: existingConnections } = useMySQLConnections();
  const { data: tables, isLoading: tablesLoading } = useMySQLTables(connectionRid ?? '');
  const { data: columns, isLoading: columnsLoading } = useMySQLTableColumns(
    connectionRid ?? '',
    selectedTable?.name ?? '',
  );
  const { data: importedTables } = useMySQLImportedTables(connectionRid ?? '');
  const mysqlImport = useMySQLImport();
  const { data: taskData } = useImportTask(taskId ?? undefined);

  const open = openModal === 'mysqlImport';

  const importedTableSet = useMemo(() => new Set(importedTables ?? []), [importedTables]);

  const filteredTables = useMemo(() => {
    if (!tables) return [];
    if (!tableSearch) return tables;
    const lower = tableSearch.toLowerCase();
    return tables.filter((t) => t.name.toLowerCase().includes(lower));
  }, [tables, tableSearch]);

  const handleClose = () => {
    setOpenModal(null);
    setStep(0);
    setConnectionRid(null);
    setSelectedTable(null);
    setSelectedColumns([]);
    setDatasetName('');
    setTaskId(null);
    setTableSearch('');
  };

  const handleSelectConnection = (rid: string) => {
    setConnectionRid(rid);
  };

  const handleGoToTables = () => {
    if (connectionRid) setStep(1);
  };

  const handleSelectTable = (table: MySQLTableInfo) => {
    setSelectedTable(table);
    setDatasetName(table.name);
    setStep(2);
  };

  // Initialize selectedColumns with PK columns when columns load
  const handleColumnsLoaded = (cols: MySQLColumnInfo[]) => {
    if (selectedColumns.length === 0) {
      const pkCols = cols.filter((c) => c.isPrimaryKey).map((c) => c.name);
      if (pkCols.length > 0) setSelectedColumns(pkCols);
    }
  };

  // Call this effect-like logic when columns data changes
  if (columns && columns.length > 0 && selectedColumns.length === 0) {
    const pkCols = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
    if (pkCols.length > 0 && selectedColumns.length === 0) {
      // Defer to avoid setting state during render
      setTimeout(() => handleColumnsLoaded(columns), 0);
    }
  }

  const handleColumnToggle = (checkedValues: string[]) => {
    // Ensure PK columns cannot be unchecked
    if (!columns) {
      setSelectedColumns(checkedValues);
      return;
    }
    const pkNames = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
    const merged = new Set(checkedValues);
    for (const pk of pkNames) merged.add(pk);
    setSelectedColumns([...merged]);
  };

  const handleStartImport = async () => {
    if (!connectionRid || !selectedTable) return;
    try {
      const task = await mysqlImport.mutateAsync({
        connectionRid,
        table: selectedTable.name,
        datasetName: datasetName || selectedTable.name,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : undefined,
      });
      setTaskId(task.taskId);
      setStep(3);
    } catch {
      message.error(t('mysqlConnection.importFailed'));
    }
  };

  const renderStep0 = () => {
    const hasConnections = existingConnections && existingConnections.length > 0;
    if (!hasConnections) {
      return <Empty description={t('mysqlConnection.noConnections')} />;
    }
    return (
      <div>
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder={t('mysqlConnection.selectConnection')}
          value={connectionRid ?? undefined}
          onChange={handleSelectConnection}
          options={existingConnections?.map((c) => ({
            label: `${c.name} (${c.host}:${c.port}/${c.databaseName})`,
            value: c.rid,
          }))}
        />
        <Button type="primary" disabled={!connectionRid} onClick={handleGoToTables}>
          {t('wizard.next')}
        </Button>
      </div>
    );
  };

  const renderStep1 = () => (
    <div>
      <Input.Search
        placeholder={t('mysqlConnection.searchTables')}
        value={tableSearch}
        onChange={(e) => setTableSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
      />
      {tablesLoading ? (
        <Spin />
      ) : (
        <Table<MySQLTableInfo>
          rowKey="name"
          dataSource={filteredTables}
          pagination={false}
          onRow={(record) => ({
            onClick: () => handleSelectTable(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('mysqlConnection.fields.name'),
              dataIndex: 'name',
              key: 'name',
              render: (name: string) => (
                <Space>
                  {name}
                  {importedTableSet.has(name) && (
                    <Tag color="orange">{t('mysqlConnection.snapshotExists')}</Tag>
                  )}
                </Space>
              ),
            },
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
        {selectedTable?.rowCount != null && (
          <Form.Item label={t('mysqlConnection.estimatedRows')}>
            <span>{selectedTable.rowCount.toLocaleString()}</span>
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
      <Button type="primary" onClick={handleStartImport} loading={mysqlImport.isPending}>
        {t('mysqlConnection.confirmImport')}
      </Button>
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
              {t('common.confirm')}
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
          <Button onClick={handleClose}>{t('common.confirm')}</Button>
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

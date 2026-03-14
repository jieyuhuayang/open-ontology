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
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMySQLConnections,
  useMySQLTables,
  useMySQLTableColumns,
  useMySQLImportedTables,
} from '@/api/mysql-connections';
import { useRegisterLiveDataset } from '@/api/imports';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type { MySQLTableInfo, MySQLColumnInfo } from '@/api/types';

const STEPS = ['connection', 'tables', 'confirm'] as const;

export default function LiveConnectionWizard() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const openModal = useDataConnectionStore((s) => s.openModal);
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);

  const [step, setStep] = useState(0);
  const [connectionRid, setConnectionRid] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<MySQLTableInfo | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [datasetName, setDatasetName] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [registeredDataset, setRegisteredDataset] = useState<{ rid: string; name: string } | null>(
    null,
  );

  const { data: existingConnections } = useMySQLConnections();
  const { data: tables, isLoading: tablesLoading } = useMySQLTables(connectionRid ?? '');
  const { data: columns, isLoading: columnsLoading } = useMySQLTableColumns(
    connectionRid ?? '',
    selectedTable?.name ?? '',
  );
  const { data: importedTables } = useMySQLImportedTables(connectionRid ?? '');
  const registerLive = useRegisterLiveDataset();

  const open = openModal === 'liveConnection';

  const importedTableSet = useMemo(() => new Set(importedTables ?? []), [importedTables]);

  const filteredTables = useMemo(() => {
    if (!tables) return [];
    if (!tableSearch) return tables;
    const lower = tableSearch.toLowerCase();
    return tables.filter((t) => t.name.toLowerCase().includes(lower));
  }, [tables, tableSearch]);

  // Auto-select all columns when columns load
  if (columns && columns.length > 0 && selectedColumns.length === 0) {
    setTimeout(() => setSelectedColumns(columns.map((c) => c.name)), 0);
  }

  const handleClose = () => {
    setOpenModal(null);
    setStep(0);
    setConnectionRid(null);
    setSelectedTable(null);
    setSelectedColumns([]);
    setDatasetName('');
    setTableSearch('');
    setRegisteredDataset(null);
  };

  const handleSelectConnection = (rid: string) => {
    setConnectionRid(rid);
  };

  const handleGoToTables = () => {
    if (connectionRid) {
      setSelectedTable(null);
      setSelectedColumns([]);
      setStep(1);
    }
  };

  const handleSelectTableRow = (table: MySQLTableInfo) => {
    setSelectedTable(table);
    setDatasetName(table.name);
    setSelectedColumns([]);
  };

  const handleNextFromStep1 = () => {
    if (selectedTable) setStep(2);
  };

  const handleColumnToggle = (checkedValues: string[]) => {
    if (!columns) {
      setSelectedColumns(checkedValues);
      return;
    }
    const pkNames = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
    const merged = new Set(checkedValues);
    for (const pk of pkNames) merged.add(pk);
    setSelectedColumns([...merged]);
  };

  const handleRegister = async () => {
    if (!connectionRid || !selectedTable) return;
    try {
      const result = await registerLive.mutateAsync({
        connectionRid,
        tableName: selectedTable.name,
        datasetName: datasetName || selectedTable.name,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : [],
      });
      setRegisteredDataset({ rid: result.rid, name: result.name });
      setStep(2);
      void queryClient.invalidateQueries({ queryKey: ['datasets'] });
      message.success(t('liveConnection.resultSummary', { name: result.name }));
    } catch {
      message.error(t('liveConnection.registerFailed'));
    }
  };

  const renderNavButtons = (
    onPrev?: () => void,
    onNext?: () => void,
    nextDisabled?: boolean,
  ) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
      <div>{onPrev && <Button onClick={onPrev}>{t('wizard.back')}</Button>}</div>
      <div>
        {onNext && (
          <Button type="primary" disabled={nextDisabled} onClick={onNext}>
            {t('wizard.next')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderStep0 = () => {
    const hasConnections = existingConnections && existingConnections.length > 0;
    if (!hasConnections) {
      return <Empty description={t('liveConnection.noConnections')} />;
    }
    return (
      <div>
        <Alert
          type="info"
          showIcon
          message={t('liveConnection.banner')}
          style={{ marginBottom: 16 }}
        />
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder={t('mysqlConnection.selectConnection')}
          value={connectionRid ?? undefined}
          onChange={handleSelectConnection}
          showSearch
          size="large"
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
          }
          options={existingConnections?.map((c) => ({
            label: `${c.name} (${c.host}:${c.port}/${c.databaseName})`,
            value: c.rid,
          }))}
        />
        {renderNavButtons(undefined, handleGoToTables, !connectionRid)}
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
          scroll={{ y: 300 }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedTable ? [selectedTable.name] : [],
            onChange: (_keys, rows) => {
              if (rows[0]) handleSelectTableRow(rows[0]);
            },
          }}
          onRow={(record) => ({
            onClick: () => handleSelectTableRow(record),
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
      {selectedTable && (
        <div style={{ marginTop: 16 }}>
          <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
            {t('mysqlConnection.selectColumns')}
          </Typography.Text>
          {columnsLoading ? (
            <Spin />
          ) : (
            <>
              <Space style={{ marginBottom: 8 }}>
                <Typography.Link
                  onClick={() => columns && setSelectedColumns(columns.map((c) => c.name))}
                >
                  {t('common.selectAll')}
                </Typography.Link>
                <Typography.Link
                  onClick={() => {
                    if (!columns) return;
                    setSelectedColumns(
                      columns.filter((c) => c.isPrimaryKey).map((c) => c.name),
                    );
                  }}
                >
                  {t('common.deselectAll')}
                </Typography.Link>
              </Space>
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
              {columns && (
                <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                  {t('import.columnsSelected', {
                    selected: selectedColumns.length,
                    total: columns.length,
                  })}
                </Typography.Text>
              )}
            </>
          )}
          <Form layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label={t('mysqlConnection.datasetName')}>
              <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
            </Form.Item>
          </Form>
        </div>
      )}
      {renderNavButtons(
        () => setStep(0),
        registeredDataset ? undefined : handleRegister,
        !selectedTable || selectedColumns.length === 0 || !datasetName,
      )}
      {!registeredDataset && selectedTable && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button
            type="primary"
            onClick={handleRegister}
            loading={registerLive.isPending}
            disabled={!selectedTable || selectedColumns.length === 0 || !datasetName}
          >
            {t('liveConnection.confirmRegister')}
          </Button>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => {
    if (registeredDataset) {
      return (
        <Result
          status="success"
          title={t('liveConnection.resultSummary', { name: registeredDataset.name })}
          extra={
            <Button type="primary" onClick={handleClose}>
              {t('common.confirm')}
            </Button>
          }
        />
      );
    }
    return <Spin />;
  };

  return (
    <Modal
      open={open}
      title={t('liveConnection.title')}
      onCancel={handleClose}
      footer={null}
      width={720}
      destroyOnClose
    >
      <Steps
        current={step}
        items={STEPS.map((s) => ({ title: t(`liveConnection.steps.${s}`) }))}
        style={{ marginBottom: 24 }}
      />
      {step === 0 && renderStep0()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
    </Modal>
  );
}

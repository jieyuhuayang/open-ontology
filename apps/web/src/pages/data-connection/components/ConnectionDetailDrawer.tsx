import { Drawer, Table, Input, Tabs, Spin, Tag, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMySQLConnection, useMySQLTables, useMySQLTableColumns, useMySQLTablePreview } from '@/api/mysql-connections';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import { useState, useMemo } from 'react';
import type { MySQLTableInfo, MySQLColumnInfo } from '@/api/types';
import type { ColumnsType } from 'antd/es/table';

export default function ConnectionDetailDrawer() {
  const { t } = useTranslation();
  const rid = useDataConnectionStore((s) => s.detailConnectionRid);
  const setDetailConnectionRid = useDataConnectionStore((s) => s.setDetailConnectionRid);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');

  const { data: connection } = useMySQLConnection(rid);
  const { data: tables, isLoading: tablesLoading } = useMySQLTables(rid ?? '');
  const { data: columns, isLoading: columnsLoading } = useMySQLTableColumns(rid ?? '', selectedTable ?? '');
  const { data: preview, isLoading: previewLoading } = useMySQLTablePreview(rid ?? '', selectedTable ?? '');

  const filteredTables = useMemo(() => {
    if (!tables) return [];
    if (!tableSearch) return tables;
    return tables.filter((t) => t.name.toLowerCase().includes(tableSearch.toLowerCase()));
  }, [tables, tableSearch]);

  const handleClose = () => {
    setDetailConnectionRid(null);
    setSelectedTable(null);
    setTableSearch('');
  };

  const tableListColumns: ColumnsType<MySQLTableInfo> = [
    {
      title: t('mysqlConnection.fields.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('mysqlConnection.estimatedRows'),
      dataIndex: 'rowCount',
      key: 'rowCount',
      width: 100,
      render: (v: number | null) => v?.toLocaleString() ?? '—',
    },
  ];

  const structureColumns: ColumnsType<MySQLColumnInfo> = [
    { title: t('mysqlConnection.fields.name'), dataIndex: 'name', key: 'name' },
    { title: t('dataConnection.type'), dataIndex: 'dataType', key: 'dataType' },
    {
      title: 'PK',
      dataIndex: 'isPrimaryKey',
      key: 'isPrimaryKey',
      width: 60,
      render: (v: boolean) => (v ? <Tag color="gold">PK</Tag> : null),
    },
    {
      title: 'Nullable',
      dataIndex: 'isNullable',
      key: 'isNullable',
      width: 80,
      render: (v: boolean) => (v ? 'NULL' : 'NOT NULL'),
    },
  ];

  const previewColumns = preview?.columns?.map((col) => ({
    title: col.name,
    dataIndex: col.name,
    key: col.name,
    ellipsis: true,
  })) ?? [];

  return (
    <Drawer
      title={connection ? `${t('dataConnection.schemaDrawerTitle')} — ${connection.name}` : t('dataConnection.schemaDrawerTitle')}
      open={!!rid}
      onClose={handleClose}
      width={960}
      destroyOnClose
    >
      <div style={{ display: 'flex', gap: 16, height: '100%' }}>
        {/* Left: Table list */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('dataConnection.searchTables')}
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            allowClear
            style={{ marginBottom: 8 }}
          />
          {tablesLoading ? (
            <Spin />
          ) : filteredTables.length === 0 ? (
            <Empty description={t('dataConnection.noTables')} />
          ) : (
            <Table<MySQLTableInfo>
              rowKey="name"
              columns={tableListColumns}
              dataSource={filteredTables}
              pagination={false}
              size="small"
              scroll={{ y: 500 }}
              rowClassName={(record) => (record.name === selectedTable ? 'ant-table-row-selected' : '')}
              onRow={(record) => ({
                onClick: () => setSelectedTable(record.name),
                style: { cursor: 'pointer' },
              })}
            />
          )}
        </div>

        {/* Right: Selected table details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedTable ? (
            <Tabs
              items={[
                {
                  key: 'structure',
                  label: t('dataConnection.tableStructure'),
                  children: columnsLoading ? (
                    <Spin />
                  ) : (
                    <Table<MySQLColumnInfo>
                      rowKey="name"
                      columns={structureColumns}
                      dataSource={columns ?? []}
                      pagination={false}
                      size="small"
                    />
                  ),
                },
                {
                  key: 'preview',
                  label: t('dataConnection.tablePreview'),
                  children: previewLoading ? (
                    <Spin />
                  ) : (
                    <Table
                      rowKey={(_, index) => String(index)}
                      columns={previewColumns}
                      dataSource={preview?.rows ?? []}
                      pagination={{ pageSize: 20 }}
                      scroll={{ x: 'max-content' }}
                      size="small"
                    />
                  ),
                },
              ]}
            />
          ) : (
            <Empty description={t('mysqlConnection.browseTable')} />
          )}
        </div>
      </div>
    </Drawer>
  );
}

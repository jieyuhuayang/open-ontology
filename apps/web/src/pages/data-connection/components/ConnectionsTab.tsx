import { Button, Table, Space, Popconfirm, Tag, App } from 'antd';
import { PlusOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMySQLConnections, useDeleteMySQLConnection, useTestMySQLConnection } from '@/api/mysql-connections';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type { MySQLConnection, MySQLConnectionTestRequest } from '@/api/types';
import { useState } from 'react';
import type { ColumnsType } from 'antd/es/table';

export default function ConnectionsTab() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { data: connections, isLoading } = useMySQLConnections();
  const deleteMutation = useDeleteMySQLConnection();
  const testMutation = useTestMySQLConnection();
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);
  const [testingRid, setTestingRid] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  const handleTest = async (conn: MySQLConnection) => {
    setTestingRid(conn.rid);
    try {
      const req: MySQLConnectionTestRequest = {
        host: conn.host,
        port: conn.port,
        databaseName: conn.databaseName,
        username: conn.username,
        password: '',
        sslEnabled: false,
        connectionRid: conn.rid,
      };
      const result = await testMutation.mutateAsync(req);
      setTestResults((prev) => ({ ...prev, [conn.rid]: { success: result.success, error: result.error ?? undefined } }));
      if (result.success) {
        message.success(t('mysqlConnection.testSuccess'));
      } else {
        message.error(t('mysqlConnection.testFailed', { error: result.error }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [conn.rid]: { success: false, error: 'Unknown error' } }));
    } finally {
      setTestingRid(null);
    }
  };

  const handleDelete = async (rid: string, name: string) => {
    try {
      await deleteMutation.mutateAsync(rid);
      message.success(t('dataConnection.deleteConnectionSuccess'));
    } catch {
      message.error(t('common.delete') + ' failed');
    }
    // Clear test result for deleted connection
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[rid];
      return next;
    });
  };

  const columns: ColumnsType<MySQLConnection> = [
    {
      title: t('dataConnection.connectionName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('mysqlConnection.fields.host'),
      dataIndex: 'host',
      key: 'host',
    },
    {
      title: t('mysqlConnection.fields.port'),
      dataIndex: 'port',
      key: 'port',
      width: 80,
    },
    {
      title: t('mysqlConnection.fields.database'),
      dataIndex: 'databaseName',
      key: 'databaseName',
    },
    {
      title: t('dataConnection.status'),
      key: 'status',
      width: 120,
      render: (_: unknown, record: MySQLConnection) => {
        const result = testResults[record.rid];
        if (testingRid === record.rid) return <Tag color="processing">{t('dataConnection.testing')}</Tag>;
        if (!result) return <Tag>—</Tag>;
        return result.success ? (
          <Tag color="success">{t('dataConnection.connected')}</Tag>
        ) : (
          <Tag color="error">{t('dataConnection.failed')}</Tag>
        );
      },
    },
    {
      title: t('dataConnection.lastUsed'),
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 160,
      render: (val: string | null) => (val ? new Date(val).toLocaleString() : t('dataConnection.never')),
    },
    {
      key: 'actions',
      width: 160,
      render: (_: unknown, record: MySQLConnection) => (
        <Space>
          <Button
            size="small"
            icon={<ApiOutlined />}
            loading={testingRid === record.rid}
            onClick={() => handleTest(record)}
          >
            {t('mysqlConnection.testConnection')}
          </Button>
          <Popconfirm
            title={t('dataConnection.deleteConnection')}
            description={t('dataConnection.deleteConnectionConfirm', { name: record.name })}
            onConfirm={() => handleDelete(record.rid, record.name)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenModal('mysqlImport')}>
          {t('dataset.importFromMySQL')}
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => setOpenModal('fileUpload')}>
          {t('dataset.uploadFile')}
        </Button>
      </div>
      <Table<MySQLConnection>
        rowKey="rid"
        columns={columns}
        dataSource={connections ?? []}
        loading={isLoading}
        pagination={false}
        locale={{ emptyText: t('dataConnection.noConnections') }}
      />
    </div>
  );
}

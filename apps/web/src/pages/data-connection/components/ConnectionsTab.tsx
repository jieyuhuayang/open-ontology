import { Button, Table, Space, Popconfirm, Tag, App } from 'antd';
import { PlusOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useMySQLConnections, useDeleteMySQLConnection, useTestMySQLConnection } from '@/api/mysql-connections';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type { MySQLConnection, MySQLConnectionTestRequest } from '@/api/types';
import { useState } from 'react';
import type { ColumnsType } from 'antd/es/table';

function formatRelativeTime(val: string | null | undefined): string {
  if (!val) return '—';
  const date = new Date(val);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return '< 1 min';
  if (diffMin < 60) return `${diffMin} min`;
  if (diffHr < 24) return `${diffHr} hr`;
  if (diffDay < 30) return `${diffDay} d`;
  return date.toLocaleDateString();
}

export default function ConnectionsTab() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { data: connections, isLoading } = useMySQLConnections();
  const deleteMutation = useDeleteMySQLConnection();
  const testMutation = useTestMySQLConnection();
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);
  const setDetailConnectionRid = useDataConnectionStore((s) => s.setDetailConnectionRid);
  const [testingRid, setTestingRid] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
      if (result.success) {
        message.success(t('mysqlConnection.testSuccess'));
      } else {
        message.error(t('mysqlConnection.testFailed', { error: result.error }));
      }
      // Refetch connections to get updated status from backend
      queryClient.invalidateQueries({ queryKey: ['mysql-connections'] });
    } catch {
      message.error(t('mysqlConnection.testFailed', { error: 'Unknown error' }));
    } finally {
      setTestingRid(null);
    }
  };

  const handleDelete = async (rid: string) => {
    try {
      await deleteMutation.mutateAsync(rid);
      message.success(t('dataConnection.deleteConnectionSuccess'));
    } catch {
      message.error(t('common.delete') + ' failed');
    }
  };

  const getStatusTag = (record: MySQLConnection) => {
    if (testingRid === record.rid) return <Tag color="processing">{t('dataConnection.testing')}</Tag>;
    const status = (record as MySQLConnection & { status?: string }).status ?? 'untested';
    if (status === 'connected') return <Tag color="success">{t('dataConnection.connected')}</Tag>;
    if (status === 'failed') return <Tag color="error">{t('dataConnection.failed')}</Tag>;
    return <Tag>{t('dataConnection.untested')}</Tag>;
  };

  const columns: ColumnsType<MySQLConnection> = [
    {
      title: t('dataConnection.connectionName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record: MySQLConnection) => (
        <a onClick={() => setDetailConnectionRid(record.rid)}>{name}</a>
      ),
    },
    {
      title: t('dataConnection.type'),
      key: 'type',
      width: 100,
      render: () => <Tag>MySQL</Tag>,
    },
    {
      title: t('dataConnection.status'),
      key: 'status',
      width: 120,
      render: (_: unknown, record: MySQLConnection) => getStatusTag(record),
    },
    {
      title: t('dataConnection.datasetCount'),
      dataIndex: 'datasetCount',
      key: 'datasetCount',
      width: 100,
      render: (val: number) => val ?? 0,
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
            onConfirm={() => handleDelete(record.rid)}
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
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenModal('newConnection')}>
          {t('dataConnection.newConnection')}
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

import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DynamicIcon from '@/components/DynamicIcon';
import ChangeStateBadge from '@/components/ChangeStateBadge';
import type { ObjectType, ResourceStatus, Visibility } from '@/api/types';

const STATUS_COLORS: Record<ResourceStatus, string> = {
  active: 'green',
  experimental: 'orange',
  deprecated: 'red',
};

const VISIBILITY_COLORS: Record<Visibility, string> = {
  prominent: 'blue',
  normal: 'default',
  hidden: 'default',
};

interface ObjectTypeTableProps {
  items: ObjectType[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
}

export default function ObjectTypeTable({
  items,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
}: ObjectTypeTableProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const columns: ColumnsType<ObjectType> = [
    {
      title: t('objectType.fields.displayName'),
      dataIndex: 'displayName',
      key: 'displayName',
      render: (_text, record) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <DynamicIcon name={record.icon.name} color={record.icon.color} size={16} />
          {record.displayName}
        </span>
      ),
    },
    {
      title: t('objectType.fields.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: ResourceStatus) => (
        <Tag color={STATUS_COLORS[status]}>{t(`objectType.status.${status}`)}</Tag>
      ),
    },
    {
      title: t('objectType.fields.visibility'),
      dataIndex: 'visibility',
      key: 'visibility',
      width: 140,
      render: (visibility: Visibility) => (
        <Tag color={VISIBILITY_COLORS[visibility]}>{t(`objectType.visibility.${visibility}`)}</Tag>
      ),
    },
    {
      title: t('objectType.fields.changeState'),
      dataIndex: 'changeState',
      key: 'changeState',
      width: 120,
      render: (_val, record) => <ChangeStateBadge state={record.changeState} />,
    },
  ];

  return (
    <Table<ObjectType>
      columns={columns}
      dataSource={items}
      rowKey="rid"
      loading={loading}
      onRow={(record) => ({
        onClick: () => navigate(`/object-types/${record.rid}`),
        style: { cursor: 'pointer' },
      })}
      pagination={{
        current: page,
        pageSize,
        total,
        onChange: onPageChange,
        showSizeChanger: true,
      }}
    />
  );
}

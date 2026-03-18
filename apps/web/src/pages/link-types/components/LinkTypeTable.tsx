import { Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/StatusBadge';
import ChangeStateBadge from '@/components/ChangeStateBadge';
import type { LinkType, ResourceStatus } from '@/api/types';

const { Text } = Typography;

interface LinkTypeTableProps {
  items: LinkType[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick: (rid: string) => void;
}

export default function LinkTypeTable({
  items,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onRowClick,
}: LinkTypeTableProps) {
  const { t } = useTranslation();

  const columns: ColumnsType<LinkType> = [
    {
      title: t('linkType.fields.relationship'),
      key: 'relationship',
      render: (_val, record) => {
        const nameA = record.sideA.objectTypeDisplayName ?? record.sideA.objectTypeRid;
        const nameB = record.sideB.objectTypeDisplayName ?? record.sideB.objectTypeRid;
        return (
          <span>
            <Tag>{nameA}</Tag>
            <Text type="secondary" style={{ margin: '0 4px' }}>
              →
            </Text>
            <Tag>{nameB}</Tag>
          </span>
        );
      },
    },
    {
      title: t('linkType.fields.linkNames'),
      key: 'linkNames',
      render: (_val, record) => (
        <Text type="secondary">
          {record.sideA.displayName} / {record.sideB.displayName}
        </Text>
      ),
    },
    {
      title: t('linkType.fields.cardinality'),
      dataIndex: 'cardinality',
      key: 'cardinality',
      width: 140,
      render: (val: string) => t(`linkType.cardinality.${val}`),
    },
    {
      title: t('linkType.fields.joinMethod'),
      dataIndex: 'joinMethod',
      key: 'joinMethod',
      width: 140,
      render: (val: string) =>
        val === 'join-table'
          ? t('linkType.joinMethod.joinTable')
          : val === 'backing-object'
            ? t('linkType.joinMethod.backingObject')
            : t('linkType.joinMethod.foreignKey'),
    },
    {
      title: t('linkType.fields.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: ResourceStatus) => <StatusBadge status={status} />,
    },
    {
      title: t('linkType.fields.changeState'),
      dataIndex: 'changeState',
      key: 'changeState',
      width: 120,
      render: (_val, record) => <ChangeStateBadge state={record.changeState} />,
    },
  ];

  return (
    <Table<LinkType>
      columns={columns}
      dataSource={items}
      rowKey="rid"
      loading={loading}
      onRow={(record) => ({
        onClick: () => onRowClick(record.rid),
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

import { Button, Card, Empty, Flex, Table, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useObjectType } from '@/api/object-types';
import { useLinkTypes } from '@/api/link-types';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';
import MetadataSection from './components/MetadataSection';
import PlaceholderCard from '@/components/PlaceholderCard';
import StatusBadge from '@/components/StatusBadge';
import type { LinkType, ResourceStatus } from '@/api/types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

export default function ObjectTypeOverviewPage() {
  const { rid } = useParams<{ rid: string }>();
  const { t } = useTranslation();
  const { data } = useObjectType(rid ?? '');
  const { data: linkTypesData } = useLinkTypes(1, 100, { objectTypeRid: rid });
  const openCreateLinkType = useCreateLinkTypeModalStore((s) => s.open);

  if (!data) return null;

  const linkTypeColumns: ColumnsType<LinkType> = [
    {
      title: t('linkType.fields.id'),
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: t('linkType.fields.sideA'),
      key: 'sideA',
      render: (_val, record) => (
        <Tag>{record.sideA.objectTypeDisplayName ?? record.sideA.objectTypeRid}</Tag>
      ),
    },
    {
      title: t('linkType.fields.sideB'),
      key: 'sideB',
      render: (_val, record) => (
        <Tag>{record.sideB.objectTypeDisplayName ?? record.sideB.objectTypeRid}</Tag>
      ),
    },
    {
      title: t('linkType.fields.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ResourceStatus) => <StatusBadge status={status} />,
    },
  ];

  return (
    <div>
      <MetadataSection data={data} />
      <Flex vertical gap={16}>
        <PlaceholderCard
          titleKey="objectType.placeholders.properties"
          emptyTextKey="objectType.placeholders.propertiesEmpty"
        />
        <PlaceholderCard
          titleKey="objectType.placeholders.actionTypes"
          emptyTextKey="objectType.placeholders.actionTypesEmpty"
        />
        <Card>
          <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>
              {t('objectType.placeholders.linkTypes')}
            </Title>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => openCreateLinkType(rid)}
            >
              {t('linkType.newLinkType')}
            </Button>
          </Flex>
          {linkTypesData && linkTypesData.items.length > 0 ? (
            <Table<LinkType>
              columns={linkTypeColumns}
              dataSource={linkTypesData.items}
              rowKey="rid"
              size="small"
              pagination={false}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('objectType.placeholders.linkTypesEmpty')}
            />
          )}
        </Card>
        <Card>
          <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>
              {t('objectType.backingDatasource')}
            </Title>
          </Flex>
          {data.backingDatasource ? (
            <Flex align="center" gap={8}>
              <DatabaseOutlined />
              <Text>{JSON.stringify(data.backingDatasource)}</Text>
            </Flex>
          ) : (
            <Flex vertical align="flex-start" gap={8}>
              <Text type="secondary">{t('objectType.noDatasource')}</Text>
              <Tooltip title={t('common.comingSoon')}>
                <Button size="small" icon={<PlusOutlined />} disabled>
                  {t('objectType.addDatasource')}
                </Button>
              </Tooltip>
            </Flex>
          )}
        </Card>
      </Flex>
    </div>
  );
}

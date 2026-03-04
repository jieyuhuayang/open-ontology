import { Button, Card, Empty, Flex, List, Table, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useObjectType } from '@/api/object-types';
import { useProperties } from '@/api/properties';
import { useLinkTypes } from '@/api/link-types';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';
import MetadataSection from './components/MetadataSection';
import PropertyTypeIcon from '@/components/PropertyTypeIcon';
import StatusBadge from '@/components/StatusBadge';
import type { LinkType, Property, ResourceStatus } from '@/api/types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const ACTION_LABELS: Record<string, { color: string; labelKey: string }> = {
  create: { color: 'green', labelKey: 'objectType.actions.create' },
  modify: { color: 'blue', labelKey: 'objectType.actions.modify' },
  delete: { color: 'red', labelKey: 'objectType.actions.delete' },
};

export default function ObjectTypeOverviewPage() {
  const { rid } = useParams<{ rid: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useObjectType(rid ?? '');
  const { data: propertiesData } = useProperties(rid ?? '');
  const { data: linkTypesData } = useLinkTypes(1, 100, { objectTypeRid: rid });
  const openCreateLinkType = useCreateLinkTypeModalStore((s) => s.open);

  if (!data) return null;

  const properties = propertiesData?.items ?? [];
  const intendedActions = data.intendedActions ?? [];

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
        {/* Properties Card */}
        <Card>
          <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>
              {t('objectType.placeholders.properties')}{' '}
              <Text type="secondary">({properties.length})</Text>
            </Title>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => navigate(`/object-types/${rid}/properties`)}
            >
              {t('property.addProperty')}
            </Button>
          </Flex>
          {properties.length > 0 ? (
            <List<Property>
              dataSource={properties}
              size="small"
              renderItem={(p) => (
                <List.Item key={p.rid}>
                  <Flex align="center" gap={8}>
                    <PropertyTypeIcon baseType={p.baseType} />
                    <Text>{p.displayName}</Text>
                    {p.isPrimaryKey && <Tag color="orange">{t('objectType.properties.primaryKey')}</Tag>}
                    {p.isTitleKey && <Tag color="blue">{t('objectType.properties.titleKey')}</Tag>}
                  </Flex>
                </List.Item>
              )}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('objectType.placeholders.propertiesEmpty')}
            />
          )}
        </Card>

        {/* Action Types Card */}
        <Card>
          <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>
              {t('objectType.placeholders.actionTypes')}{' '}
              <Text type="secondary">({intendedActions.length})</Text>
            </Title>
          </Flex>
          {intendedActions.length > 0 ? (
            <Flex gap={8} wrap="wrap">
              {intendedActions.map((action) => {
                const config = ACTION_LABELS[action];
                return (
                  <Tag key={action} color={config?.color ?? 'default'}>
                    {config ? t(config.labelKey, { name: data.displayName }) : action}
                  </Tag>
                );
              })}
            </Flex>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('objectType.placeholders.actionTypesEmpty')}
            />
          )}
        </Card>

        {/* Link Types Card */}
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

        {/* Backing Datasource Card */}
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

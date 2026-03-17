import { Button, Card, Empty, Flex, List, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useObjectType } from '@/api/object-types';
import { useDataset } from '@/api/datasets';
import { useProperties } from '@/api/properties';
import { useLinkTypes } from '@/api/link-types';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';
import MetadataSection from './components/MetadataSection';
import PropertyTypeIcon from '@/components/PropertyTypeIcon';
import LinkTypeGraph from './components/LinkTypeGraph';
import type { Property } from '@/api/types';

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
  const { data: datasetData } = useDataset(data?.backingDatasource?.rid ?? '');

  if (!data) return null;

  const properties = propertiesData?.items ?? [];
  const intendedActions = data.intendedActions ?? [];
  const linkTypes = linkTypesData?.items ?? [];

  return (
    <div>
      <MetadataSection data={data} />
      <Flex vertical gap={16}>
        {/* Row 1: Properties + Action Types side by side */}
        <Flex gap={16}>
          {/* Properties Card */}
          <Card style={{ flex: 1 }}>
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
          <Card style={{ flex: 1 }}>
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
        </Flex>

        {/* Row 2: Link Types (full width) */}
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
          {linkTypes.length > 0 ? (
            <LinkTypeGraph
              objectTypeRid={rid ?? ''}
              objectTypeDisplayName={data.displayName}
              linkTypes={linkTypes}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('objectType.placeholders.linkTypesEmpty')}
            />
          )}
        </Card>

        {/* Row 3: Datasource (half width, reserved for future Usage card) */}
        <Flex gap={16}>
          <Card style={{ flex: 1 }}>
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
      </Flex>
    </div>
  );
}

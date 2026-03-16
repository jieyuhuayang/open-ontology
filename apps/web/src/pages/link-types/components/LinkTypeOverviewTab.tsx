import { Descriptions, Typography, Input, Radio, Tag, Tooltip, Divider, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUpdateLinkType } from '@/api/link-types';
import type { LinkType, ResourceStatus, Visibility } from '@/api/types';

const { Title, Text } = Typography;

interface LinkTypeOverviewTabProps {
  linkType: LinkType;
}

export default function LinkTypeOverviewTab({ linkType }: LinkTypeOverviewTabProps) {
  const { t } = useTranslation();
  const updateMutation = useUpdateLinkType(linkType.rid);

  const isActive = linkType.status === 'active';
  const isJoinTable = linkType.joinMethod === 'join-table';

  const handleStatusChange = (val: ResourceStatus) => {
    updateMutation.mutate({ status: val });
  };

  const handleSideDisplayNameBlur = (side: 'sideA' | 'sideB', val: string) => {
    const current = side === 'sideA' ? linkType.sideA.displayName : linkType.sideB.displayName;
    if (val !== current) {
      updateMutation.mutate({ [side]: { displayName: val } });
    }
  };

  const handleSideApiNameBlur = (side: 'sideA' | 'sideB', val: string) => {
    const current = side === 'sideA' ? linkType.sideA.apiName : linkType.sideB.apiName;
    if (val !== current) {
      updateMutation.mutate({ [side]: { apiName: val } });
    }
  };

  const handleSideVisibility = (side: 'sideA' | 'sideB', val: Visibility) => {
    updateMutation.mutate({ [side]: { visibility: val } });
  };

  const renderSide = (sideKey: 'sideA' | 'sideB', label: string) => {
    const side = linkType[sideKey];
    return (
      <div>
        <Title level={5}>{label}</Title>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('linkType.fields.objectType')}>
            <Link to={`/object-types/${side.objectTypeRid}`}>
              {side.objectTypeDisplayName ?? side.objectTypeRid}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label={t('linkType.fields.displayName')}>
            <Input
              size="small"
              defaultValue={side.displayName}
              onBlur={(e) => handleSideDisplayNameBlur(sideKey, e.target.value)}
              style={{ border: 'none', padding: 0 }}
            />
          </Descriptions.Item>
          <Descriptions.Item label={t('linkType.fields.apiName')}>
            {isActive ? (
              <Tooltip title={t('linkType.detail.cannotModifyApiNameActive')}>
                <Text copyable>{side.apiName}</Text>
              </Tooltip>
            ) : (
              <Input
                size="small"
                defaultValue={side.apiName}
                onBlur={(e) => handleSideApiNameBlur(sideKey, e.target.value)}
                style={{ border: 'none', padding: 0 }}
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('linkType.fields.visibility')}>
            <Radio.Group
              value={side.visibility}
              onChange={(e) => handleSideVisibility(sideKey, e.target.value)}
              size="small"
            >
              <Radio.Button value="prominent">
                {t('objectType.visibility.prominent')}
              </Radio.Button>
              <Radio.Button value="normal">{t('objectType.visibility.normal')}</Radio.Button>
              <Radio.Button value="hidden">{t('objectType.visibility.hidden')}</Radio.Button>
            </Radio.Group>
          </Descriptions.Item>
          {side.foreignKeyPropertyId && (
            <Descriptions.Item label={t('linkType.detail.fkProperty')}>
              <Text code>{side.foreignKeyPropertyId}</Text>
            </Descriptions.Item>
          )}
          {side.joinTableColumn && (
            <Descriptions.Item label={t('linkType.detail.jtColumn')}>
              <Text code>{side.joinTableColumn}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    );
  };

  return (
    <Flex vertical gap={16}>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label={t('linkType.fields.id')}>{linkType.id}</Descriptions.Item>
        <Descriptions.Item label={t('linkType.fields.rid')}>
          <Text copyable>{linkType.rid}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t('linkType.fields.cardinality')}>
          <Tag>{t(`linkType.cardinality.${linkType.cardinality}`)}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('linkType.fields.joinMethod')}>
          <Tag>{isJoinTable ? t('linkType.joinMethod.joinTable') : t('linkType.joinMethod.foreignKey')}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('linkType.fields.status')}>
          <Radio.Group
            value={linkType.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            size="small"
          >
            <Radio.Button value="experimental">
              {t('objectType.status.experimental')}
            </Radio.Button>
            <Radio.Button value="active">{t('objectType.status.active')}</Radio.Button>
            <Radio.Button value="deprecated">
              {t('objectType.status.deprecated')}
            </Radio.Button>
          </Radio.Group>
        </Descriptions.Item>
      </Descriptions>

      <Divider style={{ margin: '8px 0' }} />

      {renderSide('sideA', t('linkType.wizard.sideA'))}
      {renderSide('sideB', t('linkType.wizard.sideB'))}

      <Divider style={{ margin: '8px 0' }} />

      <Descriptions column={2} size="small">
        <Descriptions.Item label={t('linkType.fields.createdAt')}>
          {new Date(linkType.createdAt).toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label={t('linkType.fields.createdBy')}>
          {linkType.createdBy}
        </Descriptions.Item>
        <Descriptions.Item label={t('linkType.fields.lastModifiedAt')}>
          {new Date(linkType.lastModifiedAt).toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label={t('linkType.fields.lastModifiedBy')}>
          {linkType.lastModifiedBy}
        </Descriptions.Item>
      </Descriptions>
    </Flex>
  );
}

import {
  Typography,
  Input,
  Radio,
  Tag,
  Tooltip,
  Divider,
  Flex,
  Card,
  Space,
  theme,
  Select,
} from 'antd';
import {
  CopyOutlined,
  KeyOutlined,
  TableOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUpdateLinkType } from '@/api/link-types';
import type { LinkType, ResourceStatus, Visibility, JoinMethod } from '@/api/types';

const { Title, Text, Paragraph } = Typography;

interface LinkTypeOverviewTabProps {
  linkType: LinkType;
}

const JOIN_METHOD_OPTIONS: { key: JoinMethod; icon: React.ReactNode; labelKey: string }[] = [
  { key: 'foreign-key', icon: <KeyOutlined />, labelKey: 'linkType.joinMethod.foreignKey' },
  { key: 'join-table', icon: <TableOutlined />, labelKey: 'linkType.joinMethod.joinTable' },
  {
    key: 'backing-object',
    icon: <AppstoreOutlined />,
    labelKey: 'linkType.joinMethod.backingObject',
  },
];

export default function LinkTypeOverviewTab({ linkType }: LinkTypeOverviewTabProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const updateMutation = useUpdateLinkType(linkType.rid);

  const isActive = linkType.status === 'active';
  const isBackingObject = linkType.joinMethod === 'backing-object';

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

  const otNameA = linkType.sideA.objectTypeDisplayName ?? linkType.sideA.objectTypeRid;
  const otNameB = linkType.sideB.objectTypeDisplayName ?? linkType.sideB.objectTypeRid;

  const isManyOnBSide =
    linkType.cardinality === 'one-to-many' || linkType.cardinality === 'many-to-many';
  const isManyOnASide =
    linkType.cardinality === 'many-to-one' || linkType.cardinality === 'many-to-many';

  const renderDirectionSection = (
    sideKey: 'sideA' | 'sideB',
    sourceOtName: string,
    targetOtName: string,
    sourceOtRid: string,
    targetOtRid: string,
    isMany: boolean,
  ) => {
    const side = linkType[sideKey];
    const naturalLangKey = isMany
      ? 'linkType.detail.eachHasMany'
      : 'linkType.detail.eachHasOne';

    return (
      <Card
        size="small"
        style={{ borderColor: token.colorBorderSecondary }}
        styles={{ header: { borderBottom: `1px solid ${token.colorBorderSecondary}` } }}
        title={
          <Space>
            <Link to={`/object-types/${sourceOtRid}`}>
              <Tag color="blue">{sourceOtName}</Tag>
            </Link>
            <ArrowRightOutlined style={{ color: token.colorTextTertiary }} />
            <Link to={`/object-types/${targetOtRid}`}>
              <Tag color="blue">{targetOtName}</Tag>
            </Link>
          </Space>
        }
      >
        <Flex vertical gap={16}>
          {/* Natural language description */}
          <Paragraph
            type="secondary"
            style={{ margin: 0, fontSize: 13 }}
          >
            {t(naturalLangKey, { source: sourceOtName, target: targetOtName })}
          </Paragraph>

          {/* Display Name */}
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('linkType.fields.displayName')}
            </Text>
            <Input
              size="small"
              defaultValue={side.displayName}
              onBlur={(e) => handleSideDisplayNameBlur(sideKey, e.target.value)}
              style={{ maxWidth: 300 }}
            />
          </div>

          {/* API Name */}
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('linkType.fields.apiName')}
            </Text>
            {isActive ? (
              <Tooltip title={t('linkType.detail.cannotModifyApiNameActive')}>
                <Text code copyable>
                  {sourceOtName.replace(/\s/g, '')}.{side.apiName}
                  {isMany ? '.all()' : '.get()'}
                </Text>
              </Tooltip>
            ) : (
              <Flex align="center" gap={4}>
                <Text type="secondary" code>
                  {sourceOtName.replace(/\s/g, '')}.
                </Text>
                <Input
                  size="small"
                  defaultValue={side.apiName}
                  onBlur={(e) => handleSideApiNameBlur(sideKey, e.target.value)}
                  style={{ maxWidth: 200 }}
                />
                <Text type="secondary" code>
                  {isMany ? '.all()' : '.get()'}
                </Text>
              </Flex>
            )}
          </div>

          {/* Visibility */}
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('linkType.fields.visibility')}
            </Text>
            <Select
              size="small"
              value={side.visibility}
              onChange={(val) => handleSideVisibility(sideKey, val)}
              style={{ width: 140 }}
              options={[
                { value: 'prominent', label: t('objectType.visibility.prominent') },
                { value: 'normal', label: t('objectType.visibility.normal') },
                { value: 'hidden', label: t('objectType.visibility.hidden') },
              ]}
            />
          </div>

          {/* FK Property (conditional) */}
          {side.foreignKeyPropertyId && (
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {t('linkType.detail.fkProperty')}
              </Text>
              <Text code>{side.foreignKeyPropertyId}</Text>
            </div>
          )}

          {/* JT Column (conditional) */}
          {side.joinTableColumn && (
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {t('linkType.detail.jtColumn')}
              </Text>
              <Text code>{side.joinTableColumn}</Text>
            </div>
          )}
        </Flex>
      </Card>
    );
  };

  return (
    <Flex vertical gap={24}>
      {/* Section 1: Status + ID/RID */}
      <Card size="small" style={{ borderColor: token.colorBorderSecondary }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
          <Space size="large">
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {t('linkType.fields.status')}
              </Text>
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
            </div>
          </Space>
          <Space size="large">
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                {t('linkType.fields.id')}
              </Text>
              <Text copyable={{ icon: <CopyOutlined style={{ fontSize: 11 }} /> }}>
                {linkType.id}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                {t('linkType.fields.rid')}
              </Text>
              <Text
                copyable={{ icon: <CopyOutlined style={{ fontSize: 11 }} /> }}
                style={{ fontSize: 12 }}
              >
                {linkType.rid}
              </Text>
            </div>
          </Space>
        </Flex>
      </Card>

      {/* Section 2: Configuration — Join Method + Visual Diagram */}
      <div>
        <Title level={5} style={{ marginBottom: 12 }}>
          {t('linkType.detail.configuration')}
        </Title>
        <Card size="small" style={{ borderColor: token.colorBorderSecondary }}>
          <Flex vertical gap={16}>
            {/* Join Method cards */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {t('linkType.fields.joinMethod')}
              </Text>
              <Flex gap={8}>
                {JOIN_METHOD_OPTIONS.map((opt) => {
                  const isSelected = linkType.joinMethod === opt.key;
                  return (
                    <Card
                      key={opt.key}
                      size="small"
                      style={{
                        width: 160,
                        borderColor: isSelected ? token.colorPrimary : token.colorBorderSecondary,
                        background: isSelected ? token.colorPrimaryBg : undefined,
                        cursor: 'default',
                      }}
                    >
                      <Flex align="center" gap={8}>
                        <span
                          style={{
                            color: isSelected ? token.colorPrimary : token.colorTextTertiary,
                          }}
                        >
                          {opt.icon}
                        </span>
                        <Text
                          strong={isSelected}
                          style={{
                            color: isSelected ? token.colorPrimary : token.colorText,
                            fontSize: 13,
                          }}
                        >
                          {t(opt.labelKey)}
                        </Text>
                      </Flex>
                    </Card>
                  );
                })}
              </Flex>
            </div>

            <Divider style={{ margin: 0 }} />

            {/* Visual relationship diagram */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {t('linkType.fields.cardinality')} — {t(`linkType.cardinality.${linkType.cardinality}`)}
              </Text>
              <Flex align="center" justify="center" gap={24} style={{ padding: '12px 0' }}>
                <Link to={`/object-types/${linkType.sideA.objectTypeRid}`}>
                  <Card
                    size="small"
                    style={{
                      borderColor: token.colorPrimary,
                      background: token.colorPrimaryBg,
                      minWidth: 120,
                      textAlign: 'center',
                    }}
                  >
                    <Text strong style={{ color: token.colorPrimary }}>
                      {otNameA}
                    </Text>
                  </Card>
                </Link>

                {/* Connecting line with cardinality labels */}
                <Flex vertical align="center" gap={2}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {isManyOnASide ? 'N' : '1'}
                  </Text>
                  <div
                    style={{
                      width: 80,
                      height: 2,
                      background: token.colorPrimary,
                      borderRadius: 1,
                      position: 'relative',
                    }}
                  >
                    {/* Arrow */}
                    <div
                      style={{
                        position: 'absolute',
                        right: -4,
                        top: -4,
                        width: 0,
                        height: 0,
                        borderTop: '5px solid transparent',
                        borderBottom: '5px solid transparent',
                        borderLeft: `6px solid ${token.colorPrimary}`,
                      }}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {isManyOnBSide ? 'N' : '1'}
                  </Text>
                </Flex>

                <Link to={`/object-types/${linkType.sideB.objectTypeRid}`}>
                  <Card
                    size="small"
                    style={{
                      borderColor: token.colorPrimary,
                      background: token.colorPrimaryBg,
                      minWidth: 120,
                      textAlign: 'center',
                    }}
                  >
                    <Text strong style={{ color: token.colorPrimary }}>
                      {otNameB}
                    </Text>
                  </Card>
                </Link>
              </Flex>

              {/* FK property annotation under diagram */}
              {(linkType.sideA.foreignKeyPropertyId || linkType.sideB.foreignKeyPropertyId) && (
                <Flex justify="center" style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    FK:{' '}
                    {linkType.sideA.foreignKeyPropertyId ?? linkType.sideB.foreignKeyPropertyId}
                  </Text>
                </Flex>
              )}
            </div>
          </Flex>
        </Card>
      </div>

      {/* Section 3: Direction A → B */}
      <div>
        <Title level={5} style={{ marginBottom: 12 }}>
          {t('linkType.detail.directionTitle', { source: otNameA, target: otNameB })}
        </Title>
        {renderDirectionSection(
          'sideA',
          otNameA,
          otNameB,
          linkType.sideA.objectTypeRid,
          linkType.sideB.objectTypeRid,
          isManyOnBSide,
        )}
      </div>

      {/* Section 4: Direction B → A */}
      <div>
        <Title level={5} style={{ marginBottom: 12 }}>
          {t('linkType.detail.directionTitle', { source: otNameB, target: otNameA })}
        </Title>
        {renderDirectionSection(
          'sideB',
          otNameB,
          otNameA,
          linkType.sideB.objectTypeRid,
          linkType.sideA.objectTypeRid,
          isManyOnASide,
        )}
      </div>

      {/* Section 5: Backing Object (conditional) */}
      {isBackingObject && (
        <div>
          <Title level={5} style={{ marginBottom: 12 }}>
            {t('linkType.bo.sectionTitle')}
          </Title>
          <Card size="small" style={{ borderColor: token.colorBorderSecondary }}>
            <Flex vertical gap={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  {t('linkType.bo.backingOt')}
                </Text>
                {linkType.backingObjectTypeRid ? (
                  <Link to={`/object-types/${linkType.backingObjectTypeRid}`}>
                    <Tag color="blue">
                      {linkType.backingObjectTypeDisplayName ?? linkType.backingObjectTypeRid}
                    </Tag>
                  </Link>
                ) : (
                  <Text type="secondary" delete>
                    {t('linkType.bo.deleted')}
                  </Text>
                )}
              </div>
              <Flex gap={24}>
                <div>
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                  >
                    {t('linkType.bo.sideALink')}
                  </Text>
                  {linkType.sideALinkTypeRid ? (
                    <Link to={`/link-types/${linkType.sideALinkTypeRid}`}>
                      {linkType.sideALinkTypeId ?? linkType.sideALinkTypeRid}
                    </Link>
                  ) : (
                    <Text type="secondary" delete>
                      {t('linkType.bo.deleted')}
                    </Text>
                  )}
                </div>
                <div>
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                  >
                    {t('linkType.bo.sideBLink')}
                  </Text>
                  {linkType.sideBLinkTypeRid ? (
                    <Link to={`/link-types/${linkType.sideBLinkTypeRid}`}>
                      {linkType.sideBLinkTypeId ?? linkType.sideBLinkTypeRid}
                    </Link>
                  ) : (
                    <Text type="secondary" delete>
                      {t('linkType.bo.deleted')}
                    </Text>
                  )}
                </div>
              </Flex>
            </Flex>
          </Card>
        </div>
      )}

      {/* Section 6: Audit Info */}
      <Card size="small" style={{ borderColor: token.colorBorderSecondary }}>
        <Flex wrap="wrap" gap={32}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
              {t('linkType.fields.createdAt')}
            </Text>
            <Text>{new Date(linkType.createdAt).toLocaleString()}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
              {t('linkType.fields.createdBy')}
            </Text>
            <Text>{linkType.createdBy}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
              {t('linkType.fields.lastModifiedAt')}
            </Text>
            <Text>{new Date(linkType.lastModifiedAt).toLocaleString()}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
              {t('linkType.fields.lastModifiedBy')}
            </Text>
            <Text>{linkType.lastModifiedBy}</Text>
          </div>
        </Flex>
      </Card>
    </Flex>
  );
}

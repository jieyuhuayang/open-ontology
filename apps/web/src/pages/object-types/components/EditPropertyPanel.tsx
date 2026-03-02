import { Drawer, Descriptions, Select, Typography, Space, Button, Popconfirm, message } from 'antd';
import { useTranslation } from 'react-i18next';
import InlineEditText from '@/components/InlineEditText';
import BackingColumnSection from './BackingColumnSection';
import { useUpdateProperty, useDeleteProperty } from '@/api/properties';
import type { Property } from '@/api/types';

const { Text } = Typography;

const PRIMARY_KEY_TYPES = new Set([
  'string', 'integer', 'short', 'date', 'timestamp', 'boolean', 'byte', 'long',
]);

const TITLE_KEY_TYPES = new Set([
  'string', 'integer', 'short', 'date', 'timestamp', 'boolean', 'byte', 'long',
  'float', 'double', 'decimal', 'geopoint', 'cipher', 'array',
]);

interface EditPropertyPanelInnerProps {
  property: Property;
  objectTypeStatus?: string;
  onClose: () => void;
}

function EditPropertyPanelInner({
  property,
  objectTypeStatus,
  onClose,
}: EditPropertyPanelInnerProps) {
  const { t } = useTranslation();
  const updateMutation = useUpdateProperty(property.objectTypeRid, property.rid);
  const deleteMutation = useDeleteProperty(property.objectTypeRid);

  const isActive = property.status === 'active';
  const canBePK = PRIMARY_KEY_TYPES.has(property.baseType);
  const canBeTK = TITLE_KEY_TYPES.has(property.baseType);
  const otIsActive = objectTypeStatus === 'active';

  const handleUpdate = async (update: Record<string, unknown>) => {
    try {
      await updateMutation.mutateAsync(update as Parameters<typeof updateMutation.mutateAsync>[0]);
      void message.success(t('property.updateSuccess'));
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr?.response?.data?.error?.message;
      void message.error(msg ?? t('error.somethingWentWrong'));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(property.rid);
      void message.success(t('property.deleteSuccess'));
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr?.response?.data?.error?.message;
      void message.error(msg ?? t('error.somethingWentWrong'));
    }
  };

  return (
    <Drawer
      title={property.displayName}
      open
      onClose={onClose}
      width={480}
      extra={
        <Popconfirm
          title={t('property.deleteConfirm', { name: property.displayName })}
          onConfirm={() => void handleDelete()}
          okText={t('common.delete')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true }}
        >
          <Button danger size="small" disabled={isActive || property.isPrimaryKey}>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      }
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('property.fields.rid')}>
            <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {property.rid}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('property.fields.id')}>
            <Text>{property.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('property.fields.baseType')}>
            {t(`property.baseTypes.${property.baseType}`, property.baseType)}
            {property.baseType === 'array' && property.arrayInnerType && (
              <Text type="secondary">
                {' '}[{t(`property.baseTypes.${property.arrayInnerType}`, property.arrayInnerType)}]
              </Text>
            )}
          </Descriptions.Item>
        </Descriptions>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('property.fields.displayName')}
          </Text>
          <InlineEditText
            value={property.displayName}
            onSave={(v) => void handleUpdate({ displayName: v })}
            required
          />
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('property.fields.description')}
          </Text>
          <InlineEditText
            value={property.description ?? ''}
            onSave={(v) => void handleUpdate({ description: v || null })}
            multiline
            placeholder={t('objectType.placeholders.descriptionHint')}
          />
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('property.fields.apiName')}
          </Text>
          <InlineEditText
            value={property.apiName}
            onSave={(v) => void handleUpdate({ apiName: v })}
            disabled={isActive}
            disabledTooltip={t('objectType.cannotModifyApiNameActive')}
            required
          />
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('property.fields.status')}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Select
              value={property.status}
              onChange={(v) => void handleUpdate({ status: v })}
              size="small"
              style={{ width: 160 }}
              options={[
                { value: 'experimental', label: t('objectType.status.experimental') },
                { value: 'active', label: t('objectType.status.active') },
                { value: 'deprecated', label: t('objectType.status.deprecated') },
              ]}
            />
          </div>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('property.fields.visibility')}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Select
              value={property.visibility}
              onChange={(v) => void handleUpdate({ visibility: v })}
              size="small"
              style={{ width: 160 }}
              options={[
                { value: 'prominent', label: t('objectType.visibility.prominent') },
                { value: 'normal', label: t('objectType.visibility.normal') },
                { value: 'hidden', label: t('objectType.visibility.hidden') },
              ]}
            />
          </div>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('property.fields.backingColumn')}
          </Text>
          <div style={{ marginTop: 4 }}>
            <BackingColumnSection
              backingColumn={property.backingColumn}
              propertyName={property.displayName}
              onSave={(col) => void handleUpdate({ backingColumn: col ?? '' })}
            />
          </div>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('property.fields.isPrimaryKey')}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Space>
              <Text>{property.isPrimaryKey ? '✓' : '—'}</Text>
              {canBePK && !property.isPrimaryKey && (
                <Button
                  size="small"
                  disabled={otIsActive}
                  title={otIsActive ? t('property.primaryKey.activeObjectType') : undefined}
                  onClick={() => void handleUpdate({ isPrimaryKey: true })}
                >
                  {t('property.primaryKey.set')}
                </Button>
              )}
              {property.isPrimaryKey && (
                <Button
                  size="small"
                  danger
                  onClick={() => void handleUpdate({ isPrimaryKey: false })}
                >
                  {t('property.primaryKey.unset')}
                </Button>
              )}
              {!canBePK && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('property.primaryKey.invalidType', { type: property.baseType })}
                </Text>
              )}
            </Space>
          </div>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('property.fields.isTitleKey')}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Space>
              <Text>{property.isTitleKey ? '✓' : '—'}</Text>
              {canBeTK && !property.isTitleKey && (
                <Button
                  size="small"
                  onClick={() => void handleUpdate({ isTitleKey: true })}
                >
                  {t('property.titleKey.set')}
                </Button>
              )}
              {property.isTitleKey && (
                <Button
                  size="small"
                  danger
                  onClick={() => void handleUpdate({ isTitleKey: false })}
                >
                  {t('property.titleKey.unset')}
                </Button>
              )}
              {!canBeTK && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('property.titleKey.set')}
                </Text>
              )}
            </Space>
          </div>
        </div>
      </Space>
    </Drawer>
  );
}

interface EditPropertyPanelProps {
  property: Property | null;
  objectTypeStatus?: string;
  onClose: () => void;
}

export default function EditPropertyPanel({
  property,
  objectTypeStatus,
  onClose,
}: EditPropertyPanelProps) {
  if (!property) return null;
  return (
    <EditPropertyPanelInner
      property={property}
      objectTypeStatus={objectTypeStatus}
      onClose={onClose}
    />
  );
}

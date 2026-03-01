import { Flex, Select, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import InlineEditText from '@/components/InlineEditText';
import IconSelector from '@/components/IconSelector';
import { useUpdateObjectType } from '@/api/object-types';
import type { ObjectType, ResourceStatus, Visibility, Icon } from '@/api/types';

const { Text } = Typography;

interface MetadataSectionProps {
  data: ObjectType;
}

export default function MetadataSection({ data }: MetadataSectionProps) {
  const { t } = useTranslation();
  const updateMutation = useUpdateObjectType(data.rid);

  const save = (fields: Record<string, unknown>) => {
    updateMutation.mutate(fields);
  };

  const isActive = data.status === 'active';

  return (
    <div style={{ marginBottom: 24 }}>
      <Flex gap={24}>
        <Flex vertical gap={8} style={{ flex: 1 }}>
          <Flex align="center" gap={8}>
            <IconSelector
              value={data.icon}
              onChange={(icon: Icon) => save({ icon })}
            />
            <div style={{ flex: 1 }}>
              <InlineEditText
                value={data.displayName}
                onSave={(displayName) => save({ displayName })}
                required
                style={{ fontSize: 18, fontWeight: 600 }}
              />
            </div>
          </Flex>
          <InlineEditText
            value={data.description ?? ''}
            onSave={(description) => save({ description })}
            placeholder={t('objectType.placeholders.descriptionHint')}
            multiline
          />
        </Flex>

        <Flex vertical gap={12} style={{ minWidth: 200 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('objectType.fields.status')}</Text>
            <Select<ResourceStatus>
              value={data.status}
              onChange={(status) => save({ status })}
              style={{ width: '100%' }}
              options={[
                { value: 'active', label: t('objectType.status.active') },
                { value: 'experimental', label: t('objectType.status.experimental') },
                { value: 'deprecated', label: t('objectType.status.deprecated') },
              ]}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('objectType.fields.visibility')}</Text>
            <Select<Visibility>
              value={data.visibility}
              onChange={(visibility) => save({ visibility })}
              style={{ width: '100%' }}
              options={[
                { value: 'prominent', label: t('objectType.visibility.prominent') },
                { value: 'normal', label: t('objectType.visibility.normal') },
                { value: 'hidden', label: t('objectType.visibility.hidden') },
              ]}
            />
          </div>
        </Flex>
      </Flex>

      <Flex gap={24} style={{ marginTop: 16 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('objectType.fields.id')}</Text>
          <div><Text copyable>{data.id}</Text></div>
        </div>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('objectType.fields.apiName')}</Text>
          <InlineEditText
            value={data.apiName}
            onSave={(apiName) => save({ apiName })}
            disabled={isActive}
            disabledTooltip={t('objectType.cannotModifyApiNameActive')}
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('objectType.fields.rid')}</Text>
          <div><Text copyable>{data.rid}</Text></div>
        </div>
      </Flex>
    </div>
  );
}

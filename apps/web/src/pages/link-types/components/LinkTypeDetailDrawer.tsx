import { useState } from 'react';
import {
  Drawer,
  Descriptions,
  Typography,
  Flex,
  Input,
  Radio,
  Button,
  Dropdown,
  Divider,
  Popconfirm,
} from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLinkType, useUpdateLinkType } from '@/api/link-types';
import StatusBadge from '@/components/StatusBadge';
import ChangeStateBadge from '@/components/ChangeStateBadge';
import DeleteLinkTypeModal from './DeleteLinkTypeModal';
import type { LinkTypeUpdateRequest, Cardinality, ResourceStatus, Visibility } from '@/api/types';
import type { MenuProps } from 'antd';

const { Title, Text } = Typography;

interface LinkTypeDetailDrawerProps {
  rid: string | null;
  onClose: () => void;
}

export default function LinkTypeDetailDrawer({ rid, onClose }: LinkTypeDetailDrawerProps) {
  const { t } = useTranslation();
  const { data } = useLinkType(rid ?? '');
  const updateMutation = useUpdateLinkType(rid ?? '');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleUpdate = (update: LinkTypeUpdateRequest) => {
    updateMutation.mutate(update);
  };

  const handleCardinalityChange = (val: Cardinality) => {
    handleUpdate({ cardinality: val });
  };

  const handleStatusChange = (val: ResourceStatus) => {
    handleUpdate({ status: val });
  };

  const handleSideADisplayNameBlur = (val: string) => {
    if (data && val !== data.sideA.displayName) {
      handleUpdate({ sideA: { displayName: val } });
    }
  };

  const handleSideBDisplayNameBlur = (val: string) => {
    if (data && val !== data.sideB.displayName) {
      handleUpdate({ sideB: { displayName: val } });
    }
  };

  const handleSideAVisibility = (val: Visibility) => {
    handleUpdate({ sideA: { visibility: val } });
  };

  const handleSideBVisibility = (val: Visibility) => {
    handleUpdate({ sideB: { visibility: val } });
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'delete',
      label: t('common.delete'),
      danger: true,
    },
  ];

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'delete') {
      setDeleteOpen(true);
    }
  };

  return (
    <>
      <Drawer
        title={
          data ? (
            <Flex justify="space-between" align="center">
              <Flex gap={8} align="center">
                <span>{data.id}</span>
                <StatusBadge status={data.status} />
                <ChangeStateBadge state={data.changeState} />
              </Flex>
              <Dropdown menu={{ items: menuItems, onClick: onMenuClick }}>
                <Button type="text" icon={<MoreOutlined />} />
              </Dropdown>
            </Flex>
          ) : null
        }
        open={!!rid}
        onClose={onClose}
        width={480}
        destroyOnClose
      >
        {data && (
          <Flex vertical gap={16}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('linkType.fields.id')}>{data.id}</Descriptions.Item>
              <Descriptions.Item label={t('linkType.fields.rid')}>{data.rid}</Descriptions.Item>
              <Descriptions.Item label={t('linkType.fields.cardinality')}>
                <Radio.Group
                  value={data.cardinality}
                  onChange={(e) => handleCardinalityChange(e.target.value)}
                  size="small"
                >
                  <Radio.Button value="one-to-one">
                    {t('linkType.cardinality.one-to-one')}
                  </Radio.Button>
                  <Radio.Button value="one-to-many">
                    {t('linkType.cardinality.one-to-many')}
                  </Radio.Button>
                  <Radio.Button value="many-to-one">
                    {t('linkType.cardinality.many-to-one')}
                  </Radio.Button>
                </Radio.Group>
              </Descriptions.Item>
              <Descriptions.Item label={t('linkType.fields.status')}>
                <Radio.Group
                  value={data.status}
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

            <div>
              <Title level={5}>{t('linkType.wizard.sideA')}</Title>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('linkType.fields.objectType')}>
                  <Text>{data.sideA.objectTypeDisplayName ?? data.sideA.objectTypeRid}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('linkType.fields.displayName')}>
                  <Input
                    size="small"
                    defaultValue={data.sideA.displayName}
                    onBlur={(e) => handleSideADisplayNameBlur(e.target.value)}
                    style={{ border: 'none', padding: 0 }}
                  />
                </Descriptions.Item>
                <Descriptions.Item label={t('linkType.fields.apiName')}>
                  <Text copyable>{data.sideA.apiName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('linkType.fields.visibility')}>
                  <Radio.Group
                    value={data.sideA.visibility}
                    onChange={(e) => handleSideAVisibility(e.target.value)}
                    size="small"
                  >
                    <Radio.Button value="prominent">
                      {t('objectType.visibility.prominent')}
                    </Radio.Button>
                    <Radio.Button value="normal">{t('objectType.visibility.normal')}</Radio.Button>
                    <Radio.Button value="hidden">{t('objectType.visibility.hidden')}</Radio.Button>
                  </Radio.Group>
                </Descriptions.Item>
              </Descriptions>
            </div>

            <div>
              <Title level={5}>{t('linkType.wizard.sideB')}</Title>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('linkType.fields.objectType')}>
                  <Text>{data.sideB.objectTypeDisplayName ?? data.sideB.objectTypeRid}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('linkType.fields.displayName')}>
                  <Input
                    size="small"
                    defaultValue={data.sideB.displayName}
                    onBlur={(e) => handleSideBDisplayNameBlur(e.target.value)}
                    style={{ border: 'none', padding: 0 }}
                  />
                </Descriptions.Item>
                <Descriptions.Item label={t('linkType.fields.apiName')}>
                  <Text copyable>{data.sideB.apiName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('linkType.fields.visibility')}>
                  <Radio.Group
                    value={data.sideB.visibility}
                    onChange={(e) => handleSideBVisibility(e.target.value)}
                    size="small"
                  >
                    <Radio.Button value="prominent">
                      {t('objectType.visibility.prominent')}
                    </Radio.Button>
                    <Radio.Button value="normal">{t('objectType.visibility.normal')}</Radio.Button>
                    <Radio.Button value="hidden">{t('objectType.visibility.hidden')}</Radio.Button>
                  </Radio.Group>
                </Descriptions.Item>
              </Descriptions>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('linkType.fields.createdAt')}>
                {new Date(data.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('linkType.fields.createdBy')}>
                {data.createdBy}
              </Descriptions.Item>
              <Descriptions.Item label={t('linkType.fields.lastModifiedAt')}>
                {new Date(data.lastModifiedAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('linkType.fields.lastModifiedBy')}>
                {data.lastModifiedBy}
              </Descriptions.Item>
            </Descriptions>
          </Flex>
        )}
      </Drawer>

      {data && (
        <DeleteLinkTypeModal
          rid={data.rid}
          displayId={data.id}
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onSuccess={onClose}
        />
      )}
    </>
  );
}

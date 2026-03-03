import { Button, Dropdown } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateWizardStore } from '@/stores/create-wizard-store';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';
import type { MenuProps } from 'antd';

export default function CreateMenu() {
  const { t } = useTranslation();
  const openCreateObjectType = useCreateWizardStore((s) => s.open);
  const openCreateLinkType = useCreateLinkTypeModalStore((s) => s.open);

  const items: MenuProps['items'] = [
    {
      key: 'create-object-type',
      label: t('topBar.createObjectType'),
    },
    {
      key: 'create-link-type',
      label: t('topBar.createLinkType'),
    },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'create-object-type') {
      openCreateObjectType();
    } else if (key === 'create-link-type') {
      openCreateLinkType();
    }
  };

  return (
    <Dropdown menu={{ items, onClick }}>
      <Button icon={<PlusOutlined />}>{t('topBar.new')}</Button>
    </Dropdown>
  );
}

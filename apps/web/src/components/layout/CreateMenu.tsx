import { Button, Dropdown } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreateObjectTypeModalStore } from '@/stores/create-object-type-modal-store';
import type { MenuProps } from 'antd';

export default function CreateMenu() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const openCreateObjectType = useCreateObjectTypeModalStore((s) => s.open);

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
      navigate('/link-types/new');
    }
  };

  return (
    <Dropdown menu={{ items, onClick }}>
      <Button icon={<PlusOutlined />}>{t('topBar.new')}</Button>
    </Dropdown>
  );
}

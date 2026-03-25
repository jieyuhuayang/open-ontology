import { Button, Tooltip } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSidekickStore } from '@/stores/sidekick-store';
import { useSidekickContext } from './use-sidekick-context';

export default function SidekickTrigger() {
  const { t } = useTranslation();
  const toggle = useSidekickStore((s) => s.toggle);
  const isOpen = useSidekickStore((s) => s.isOpen);
  const context = useSidekickContext();

  if (!context) return null;

  return (
    <Tooltip title={t('sidekick.title')}>
      <Button
        type={isOpen ? 'primary' : 'text'}
        icon={<ThunderboltOutlined />}
        onClick={toggle}
        aria-label={t('sidekick.title')}
      />
    </Tooltip>
  );
}

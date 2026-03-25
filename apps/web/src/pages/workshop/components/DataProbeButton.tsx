import { SearchOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';

interface DataProbeButtonProps {
  disabled?: boolean;
  onClick?: () => void;
}

export default function DataProbeButton({
  disabled = true,
  onClick,
}: DataProbeButtonProps) {
  const { t } = useTranslation();

  return (
    <Tooltip title={t('workshop.dataProbe.comingSoon')}>
      <Button
        size="small"
        icon={<SearchOutlined />}
        disabled={disabled}
        onClick={onClick}
        data-testid="data-probe-button"
      />
    </Tooltip>
  );
}

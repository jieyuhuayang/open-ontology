import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ResourceStatus } from '@/api/types';

const STATUS_COLORS: Record<ResourceStatus, string> = {
  active: 'green',
  experimental: 'orange',
  deprecated: 'red',
};

interface StatusBadgeProps {
  status: ResourceStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();
  return <Tag color={STATUS_COLORS[status]}>{t(`objectType.status.${status}`)}</Tag>;
}

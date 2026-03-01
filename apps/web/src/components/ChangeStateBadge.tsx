import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ChangeState } from '@/api/types';

const CONFIG: Record<ChangeState, { color: string; labelKey: string } | null> = {
  published: null,
  created: { color: 'green', labelKey: 'objectType.changeState.new' },
  modified: { color: 'blue', labelKey: 'objectType.changeState.modified' },
  deleted: { color: 'red', labelKey: 'objectType.changeState.deleted' },
};

interface ChangeStateBadgeProps {
  state: ChangeState;
}

export default function ChangeStateBadge({ state }: ChangeStateBadgeProps) {
  const { t } = useTranslation();
  const config = CONFIG[state];
  if (!config) return null;
  return <Tag color={config.color}>{t(config.labelKey)}</Tag>;
}

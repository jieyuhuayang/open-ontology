import { Tag, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Change } from '@/api/types';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_KEYS, changeDisplayName } from '@/utils/change-helpers';

interface ChangeItemProps {
  change: Change;
  onDiscard?: (changeId: string) => void;
}

export default function ChangeItem({ change, onDiscard }: ChangeItemProps) {
  const { t } = useTranslation();

  const displayName = changeDisplayName(change);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
      }}
    >
      <span>
        <Tag color={CHANGE_TYPE_COLORS[change.changeType]}>
          {t(CHANGE_TYPE_KEYS[change.changeType] ?? change.changeType)}
        </Tag>
        {String(displayName)}
      </span>
      {onDiscard && (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDiscard(change.id)}
        />
      )}
    </div>
  );
}

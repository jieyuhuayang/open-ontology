import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { WorkshopNode } from '../types';

interface FocusLockTagProps {
  entity: WorkshopNode | null;
  onUnlock: () => void;
}

const tagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  margin: '8px 12px',
  background: 'rgba(79, 143, 255, 0.12)',
  border: '1px solid rgba(79, 143, 255, 0.35)',
  borderRadius: 16,
  color: '#4f8eff',
  fontSize: 12,
  fontWeight: 500,
};

const closeBtnStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontSize: 10,
  opacity: 0.7,
  transition: 'opacity 0.2s',
};

export default function FocusLockTag({ entity, onUnlock }: FocusLockTagProps) {
  const { t } = useTranslation();

  if (!entity) return null;

  return (
    <div style={tagStyle} data-testid="focus-lock-tag">
      <span>✦ {t('workshop.focusLock.locked', { name: entity.displayName })}</span>
      <CloseOutlined
        style={closeBtnStyle}
        onClick={onUnlock}
        aria-label={t('workshop.focusLock.unlock')}
        data-testid="focus-lock-close"
      />
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import {
  ExpandOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';

interface WorkshopToolbarProps {
  onFitView?: () => void;
  onResetCamera?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

const toolbarStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 4,
  padding: '4px 8px',
  background: 'rgba(15, 15, 30, 0.85)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  zIndex: 10,
};

const btnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  color: 'rgba(255,255,255,0.65)',
  cursor: 'pointer',
  fontSize: 16,
  transition: 'background 0.2s, color 0.2s',
};

export default function WorkshopToolbar({
  onFitView,
  onResetCamera,
  onZoomIn,
  onZoomOut,
}: WorkshopToolbarProps) {
  const { t } = useTranslation();

  return (
    <div style={toolbarStyle} data-testid="workshop-toolbar">
      <Tooltip title={t('workshop.toolbar.zoomIn')}>
        <button style={btnStyle} onClick={onZoomIn} aria-label="zoom-in">
          <ZoomInOutlined />
        </button>
      </Tooltip>
      <Tooltip title={t('workshop.toolbar.zoomOut')}>
        <button style={btnStyle} onClick={onZoomOut} aria-label="zoom-out">
          <ZoomOutOutlined />
        </button>
      </Tooltip>
      <Tooltip title={t('workshop.toolbar.fit')}>
        <button style={btnStyle} onClick={onFitView} aria-label="fit-view">
          <ExpandOutlined />
        </button>
      </Tooltip>
      <Tooltip title={t('workshop.toolbar.reset')}>
        <button
          style={btnStyle}
          onClick={onResetCamera}
          aria-label="reset-camera"
        >
          <ReloadOutlined />
        </button>
      </Tooltip>
    </div>
  );
}

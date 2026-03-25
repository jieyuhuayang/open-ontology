import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppstoreOutlined,
  ExpandOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { notification, Tooltip } from 'antd';
import { useWorkshopStore } from '../stores/workshop-store';

interface WorkshopToolbarProps {
  onFitView?: () => void;
  onResetCamera?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  nodeCount?: number;
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

const activeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'rgba(79, 143, 255, 0.25)',
  color: '#4f8eff',
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'rgba(255,255,255,0.12)',
  alignSelf: 'center',
  margin: '0 2px',
};

export default function WorkshopToolbar({
  onFitView,
  onResetCamera,
  onZoomIn,
  onZoomOut,
  nodeCount = 0,
}: WorkshopToolbarProps) {
  const { t } = useTranslation();
  const viewMode = useWorkshopStore((s) => s.viewMode);
  const setViewMode = useWorkshopStore((s) => s.setViewMode);
  const degradeNotifiedRef = useRef(false);

  useEffect(() => {
    if (
      nodeCount > 200 &&
      viewMode === '3d' &&
      !degradeNotifiedRef.current
    ) {
      degradeNotifiedRef.current = true;
      notification.info({
        message: t('workshop.autoDegrade.suggestion'),
        btn: undefined,
        duration: 8,
      });
    }
  }, [nodeCount, viewMode, t]);

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

      <div style={separatorStyle} />

      <Tooltip title={t('workshop.toolbar.view3D')}>
        <button
          style={viewMode === '3d' ? activeBtnStyle : btnStyle}
          onClick={() => setViewMode('3d')}
          aria-label="view-3d"
          data-testid="view-3d-btn"
        >
          <AppstoreOutlined />
        </button>
      </Tooltip>
      <Tooltip title={t('workshop.toolbar.view2D')}>
        <button
          style={viewMode === '2d' ? activeBtnStyle : btnStyle}
          onClick={() => setViewMode('2d')}
          aria-label="view-2d"
          data-testid="view-2d-btn"
        >
          <NodeIndexOutlined />
        </button>
      </Tooltip>
    </div>
  );
}

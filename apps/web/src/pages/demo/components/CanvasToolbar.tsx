import { useTranslation } from 'react-i18next';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import styles from '../styles/canvas.module.css';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onReset: () => void;
}

export default function CanvasToolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onReset,
}: CanvasToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.toolbar}>
      <button
        className={styles.toolbarBtn}
        onClick={onZoomIn}
        title={t('demo.zoomIn')}
      >
        <ZoomInOutlined />
      </button>
      <button
        className={styles.toolbarBtn}
        onClick={onZoomOut}
        title={t('demo.zoomOut')}
      >
        <ZoomOutOutlined />
      </button>
      <button
        className={styles.toolbarBtn}
        onClick={onFitView}
        title={t('demo.fitView')}
      >
        <ExpandOutlined />
      </button>
      <button
        className={styles.toolbarBtn}
        onClick={onReset}
        title={t('demo.reset')}
      >
        <ReloadOutlined />
      </button>
    </div>
  );
}

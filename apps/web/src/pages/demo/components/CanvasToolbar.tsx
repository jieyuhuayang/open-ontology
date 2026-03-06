import { useTranslation } from 'react-i18next';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  ReloadOutlined,
  PlusOutlined,
  StarOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import styles from '../styles/canvas.module.css';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onReset: () => void;
  isCreationPanelOpen?: boolean;
  onToggleCreationPanel?: () => void;
  onOpenAddForm?: () => void;
}

export default function CanvasToolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onReset,
  isCreationPanelOpen,
  onToggleCreationPanel,
  onOpenAddForm,
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

      {onToggleCreationPanel && (
        <>
          <div className={styles.toolbarDivider} />
          <button
            className={`${styles.toolbarBtn} ${isCreationPanelOpen ? styles.toolbarBtnActive : ''}`}
            onClick={onToggleCreationPanel}
            title={t('demo.addObjectType')}
          >
            <PlusOutlined />
          </button>
          <div
            className={`${styles.toolbarExpansion} ${isCreationPanelOpen ? styles.toolbarExpansionOpen : ''}`}
          >
            <button
              className={styles.toolbarBtn}
              onClick={onOpenAddForm}
              title={t('demo.addObjectType')}
            >
              <StarOutlined />
            </button>
            <button
              className={styles.toolbarBtn}
              onClick={onToggleCreationPanel}
              title={t('demo.closePanel')}
            >
              <CloseOutlined />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

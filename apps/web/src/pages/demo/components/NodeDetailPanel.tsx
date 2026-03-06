import { motion } from 'framer-motion';
import { CloseOutlined } from '@ant-design/icons';
import type { GraphNode } from '../types';
import styles from '../styles/canvas.module.css';

interface NodeDetailPanelProps {
  node: GraphNode;
  onClose: () => void;
}

export default function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const { data } = node;

  return (
    <motion.div
      className={styles.detailPanel}
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <div className={styles.detailPanelHeader}>
        <div className={styles.detailPanelIcon} style={{ background: `${data.color}22`, color: data.color }}>
          {data.icon.replace('Outlined', '').charAt(0)}
        </div>
        <div className={styles.detailPanelTitle} style={{ color: data.color }}>
          {data.displayName}
        </div>
        <button className={styles.detailPanelClose} onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>

      <div className={styles.detailPanelSection}>
        <div className={styles.detailPanelSectionTitle}>Properties</div>
        {data.properties.map((p) => (
          <div key={p.name} className={styles.detailPanelProp}>
            <span className={styles.detailPanelPropName}>{p.name}</span>
            <span className={styles.detailPanelPropType}>{p.type}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

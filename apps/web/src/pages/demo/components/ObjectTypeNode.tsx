import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  UserOutlined,
  ShoppingCartOutlined,
  TagOutlined,
  CreditCardOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  StarOutlined,
  QuestionOutlined,
} from '@ant-design/icons';
import styles from '../styles/canvas.module.css';
import animStyles from '../styles/animations.module.css';
import type { DemoProperty } from '../types';

const iconMap: Record<string, React.ComponentType> = {
  UserOutlined,
  ShoppingCartOutlined,
  TagOutlined,
  CreditCardOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  StarOutlined,
};

function ObjectTypeNode({ data, selected }: NodeProps) {
  const IconComp = iconMap[data.icon as string] ?? QuestionOutlined;
  const properties = data.properties as DemoProperty[];
  const expanded = data.expanded as boolean;
  const color = data.color as string;

  return (
    <div
      className={`${styles.nodeCard} ${animStyles.breathe} ${selected ? styles.nodeCardSelected : ''}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handleStyle}
      />
      <div className={styles.nodeHeader}>
        <div
          className={styles.nodeIcon}
          style={{ background: `${color}22`, color }}
        >
          <IconComp />
        </div>
        <div>
          <div className={styles.nodeName}>{data.displayName as string}</div>
          <div className={styles.nodeStats}>
            {properties.length} properties
          </div>
        </div>
      </div>

      {expanded && (
        <div className={styles.propertyList}>
          {properties.map((p) => (
            <div key={p.name} className={styles.propertyItem}>
              <span className={styles.propertyName}>{p.name}</span>
              <span className={styles.propertyType}>{p.type}</span>
            </div>
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className={styles.handleStyle}
      />
    </div>
  );
}

export default memo(ObjectTypeNode);

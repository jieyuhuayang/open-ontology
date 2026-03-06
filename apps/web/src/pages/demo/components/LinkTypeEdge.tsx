import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import styles from '../styles/canvas.module.css';
import animStyles from '../styles/animations.module.css';

function LinkTypeEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const strokeColor = selected
    ? '#1677ff'
    : 'rgba(255, 255, 255, 0.3)';

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: '8 4',
        }}
        className={animStyles.edgePulse}
      />
      <EdgeLabelRenderer>
        <div
          className={styles.edgeLabel}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          {data?.label as string}
          <span className={styles.edgeLabelCardinality}>
            {data?.cardinality as string}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(LinkTypeEdge);

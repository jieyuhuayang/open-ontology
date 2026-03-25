import { Line } from '@react-three/drei';
import type { DragLinkState } from '../types';

interface DragLinkLineProps {
  dragLink: DragLinkState;
}

export default function DragLinkLine({ dragLink }: DragLinkLineProps) {
  const { sourcePosition, currentPointerPosition, hoveredTargetId } = dragLink;
  const hasTarget = hoveredTargetId !== null;
  const color = hasTarget ? '#4fc3f7' : '#ffffff';
  const opacity = hasTarget ? 0.6 : 0.35;

  return (
    <Line
      points={[
        [sourcePosition.x, sourcePosition.y, sourcePosition.z],
        [
          currentPointerPosition.x,
          currentPointerPosition.y,
          currentPointerPosition.z,
        ],
      ]}
      color={color}
      lineWidth={hasTarget ? 3 : 2}
      dashed
      dashSize={0.22}
      gapSize={0.14}
      transparent
      opacity={opacity}
    />
  );
}

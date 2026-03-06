import { Line } from '@react-three/drei';
import type { DragLinkState } from '../types';

interface DragLinkLineProps {
  dragLink: DragLinkState;
}

export default function DragLinkLine({ dragLink }: DragLinkLineProps) {
  const { sourcePosition, currentPointerPosition, hoveredTargetId } = dragLink;
  const color = hoveredTargetId ? '#4fc3f7' : '#ffffff';
  const opacity = hoveredTargetId ? 0.6 : 0.35;

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
      lineWidth={2}
      dashed
      dashSize={0.3}
      gapSize={0.2}
      transparent
      opacity={opacity}
    />
  );
}

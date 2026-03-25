import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { WorkshopNode, WorkshopEdge } from '../types';

interface WorkshopStarLinkProps {
  edge: WorkshopEdge;
  sourceNode: WorkshopNode | undefined;
  targetNode: WorkshopNode | undefined;
}

function getLineColor(edge: WorkshopEdge): string {
  if (edge.status === 'confirmed') return '#ffffff';
  switch (edge.confidenceLevel) {
    case 'high':
      return '#52c41a';
    case 'medium':
      return '#faad14';
    case 'low':
      return '#ff4d4f';
    default:
      return '#888888';
  }
}

export default function WorkshopStarLink({
  edge,
  sourceNode,
  targetNode,
}: WorkshopStarLinkProps) {
  if (!sourceNode || !targetNode) return null;

  const srcPos = sourceNode.position;
  const tgtPos = targetNode.position;

  const points = useMemo(
    () => [
      new THREE.Vector3(srcPos.x, srcPos.y, srcPos.z),
      new THREE.Vector3(tgtPos.x, tgtPos.y, tgtPos.z),
    ],
    [srcPos, tgtPos],
  );

  const midpoint = useMemo(
    () => [
      (srcPos.x + tgtPos.x) / 2,
      (srcPos.y + tgtPos.y) / 2 + 0.3,
      (srcPos.z + tgtPos.z) / 2,
    ] as [number, number, number],
    [srcPos, tgtPos],
  );

  const color = getLineColor(edge);
  const lineWidth = edge.status === 'confirmed' ? 2 : 1;
  const dashed = edge.status === 'pending';
  const opacity = edge.status === 'confirmed' ? 0.6 : 0.4;

  // Direction arrow at target end
  const dir = useMemo(() => {
    const d = new THREE.Vector3(
      tgtPos.x - srcPos.x,
      tgtPos.y - srcPos.y,
      tgtPos.z - srcPos.z,
    ).normalize();
    return d;
  }, [srcPos, tgtPos]);

  const arrowPos = useMemo(
    () => [
      tgtPos.x - dir.x * 0.7,
      tgtPos.y - dir.y * 0.7,
      tgtPos.z - dir.z * 0.7,
    ] as [number, number, number],
    [tgtPos, dir],
  );

  const arrowQuat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [dir]);

  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
        dashed={dashed}
        dashSize={dashed ? 0.3 : undefined}
        gapSize={dashed ? 0.15 : undefined}
      />

      {/* Arrow cone */}
      <mesh position={arrowPos} quaternion={arrowQuat}>
        <coneGeometry args={[0.08, 0.2, 8]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>

      {/* Label */}
      {edge.label && (
        <Text
          position={midpoint}
          fontSize={0.2}
          color="rgba(255,255,255,0.6)"
          anchorX="center"
          anchorY="middle"
        >
          {edge.label}
        </Text>
      )}
    </group>
  );
}

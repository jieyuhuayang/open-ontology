import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import type { WorkshopNode } from '../types';

interface WorkshopStarNodeProps {
  node: WorkshopNode;
  isSelected: boolean;
  isHovered: boolean;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
}

function getOpacity(node: WorkshopNode): number {
  if (node.status === 'confirmed') return 1.0;
  switch (node.confidenceLevel) {
    case 'high':
      return 0.8;
    case 'medium':
      return 0.5;
    case 'low':
      return 0.3;
    default:
      return 0.5;
  }
}

function getEmissiveIntensity(node: WorkshopNode): number {
  if (node.status === 'confirmed') return 1.5;
  switch (node.confidenceLevel) {
    case 'high':
      return 1.0;
    case 'medium':
      return 0.6;
    case 'low':
      return 0.3;
    default:
      return 0.5;
  }
}

export default function WorkshopStarNode({
  node,
  isSelected,
  isHovered,
  onPointerOver,
  onPointerOut,
  onClick,
  onDoubleClick,
}: WorkshopStarNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Animate low-confidence nodes with flickering
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (node.status === 'pending' && node.confidenceLevel === 'low') {
      const flicker =
        0.3 + 0.15 * Math.sin(clock.elapsedTime * 3 + node.id.length);
      meshRef.current.material.opacity = flicker;
    }
    // Pulse effect for selected/hovered
    if (glowRef.current) {
      const scale = isSelected || isHovered ? 1.8 : 1.4;
      const pulse = scale + 0.1 * Math.sin(clock.elapsedTime * 2);
      glowRef.current.scale.setScalar(pulse);
    }
  });

  // Use scale instead of recreating geometry on hover/select
  const scale = isSelected ? 1.2 : isHovered ? 1.1 : 1.0;
  const opacity = getOpacity(node);
  const emissiveIntensity = getEmissiveIntensity(node);

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      <mesh
        ref={meshRef}
        scale={scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          onPointerOver();
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onPointerOut();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick();
        }}
      >
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial
          color={node.color}
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[0, baseSize + 0.4, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(0,0,0,0.8)',
            userSelect: 'none',
          }}
        >
          {node.displayName}
        </div>
      </Html>

      {/* AI badge for pending items */}
      {node.status === 'pending' && (
        <Html
          position={[0, -baseSize - 0.3, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#ffc53d',
              textShadow: '0 0 6px rgba(255,197,61,0.5)',
              userSelect: 'none',
            }}
          >
            ✦ AI
          </div>
        </Html>
      )}
    </group>
  );
}

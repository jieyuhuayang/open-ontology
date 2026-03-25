import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import type { WorkshopNode } from '../types';

interface WorkshopStarNodeProps {
  node: WorkshopNode;
  isSelected: boolean;
  isHovered: boolean;
  isHighlighted?: boolean;
  isDragSource?: boolean;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
  onDragStart?: (nodeId: string) => void;
  onDragHoverEnter?: (nodeId: string) => void;
  onDragHoverLeave?: () => void;
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

const LONG_PRESS_MS = 200;

export default function WorkshopStarNode({
  node,
  isSelected,
  isHovered,
  isHighlighted = false,
  isDragSource = false,
  onPointerOver,
  onPointerOut,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragHoverEnter,
  onDragHoverLeave,
}: WorkshopStarNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: THREE.Event) => {
      e.stopPropagation();
      isDragging.current = false;
      longPressTimer.current = setTimeout(() => {
        isDragging.current = true;
        onDragStart?.(node.id);
      }, LONG_PRESS_MS);
    },
    [node.id, onDragStart],
  );

  const handlePointerUp = useCallback(
    (e: THREE.Event) => {
      e.stopPropagation();
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (!isDragging.current) {
        onClick();
      }
      isDragging.current = false;
    },
    [onClick],
  );

  // Animate low-confidence nodes with flickering
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (node.status === 'pending' && node.confidenceLevel === 'low') {
      const flicker =
        0.3 + 0.15 * Math.sin(clock.elapsedTime * 3 + node.id.length);
      mat.opacity = flicker;
    }
    // Glow pulse for selected/hovered/highlighted
    if (glowRef.current) {
      if (isHighlighted) {
        const pulse = 2.2 + 0.15 * Math.sin(clock.elapsedTime * 5);
        glowRef.current.scale.setScalar(pulse);
      } else {
        const scale = isSelected || isHovered ? 1.8 : 1.4;
        const pulse = scale + 0.1 * Math.sin(clock.elapsedTime * 2);
        glowRef.current.scale.setScalar(pulse);
      }
    }
  });

  const scale = isDragSource ? 1.3 : isSelected ? 1.2 : isHovered ? 1.1 : 1.0;
  const opacity = getOpacity(node);
  const emissiveIntensity = getEmissiveIntensity(node);
  const glowColor = isHighlighted ? '#00e5ff' : node.color;

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      <mesh
        ref={meshRef}
        scale={scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          onPointerOver();
          onDragHoverEnter?.(node.id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onPointerOut();
          onDragHoverLeave?.();
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
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
          color={glowColor}
          transparent
          opacity={isHighlighted ? 0.15 : 0.08}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[0, 0.9, 0]}
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
          position={[0, -0.8, 0]}
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

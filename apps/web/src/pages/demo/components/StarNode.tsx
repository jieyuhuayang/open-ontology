import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Mesh } from 'three';
import type { GraphNode } from '../types';

interface StarNodeProps {
  node: GraphNode;
  onClick: (id: string) => void;
  selected: boolean;
  isBirth?: boolean;
  onDragLinkStart?: (
    nodeId: string,
    position: { x: number; y: number; z: number },
  ) => void;
  onDragLinkEnd?: (nodeId: string) => void;
  isDragSource?: boolean;
  isDragHoverTarget?: boolean;
  isDragging?: boolean;
}

export default function StarNode({
  node,
  onClick,
  selected,
  isBirth,
  onDragLinkStart,
  onDragLinkEnd,
  isDragSource,
  isDragHoverTarget,
  isDragging,
}: StarNodeProps) {
  const meshRef = useRef<Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const phaseOffset = useRef(Math.random() * Math.PI * 2);

  // Birth animation state (refs to avoid re-renders in useFrame)
  const birthStartTime = useRef<number | null>(null);
  const birthEmissiveBoostRef = useRef(isBirth ? 4.0 : 0);

  // Long-press tracking
  const pointerDownTime = useRef<number>(0);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  // Long-press ring feedback
  const ringRef = useRef<Mesh>(null);
  const ringStartTime = useRef<number | null>(null);
  const LONG_PRESS_MS = 150;

  useEffect(() => {
    if (isBirth) {
      birthStartTime.current = performance.now();
      if (groupRef.current) {
        groupRef.current.scale.set(0, 0, 0);
      }
    }
  }, [isBirth]);

  const baseRadius = 0.5 + node.data.properties.length * 0.08;
  const color = node.data.color;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    // Birth animation: scale 0 → 1.15 → 1 over 0.6s (easeOutBack)
    if (isBirth && birthStartTime.current !== null) {
      const elapsed = (performance.now() - birthStartTime.current) / 1000;
      if (elapsed < 0.6) {
        const t = elapsed / 0.6;
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const scale = Math.max(0, 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2));
        if (groupRef.current) {
          groupRef.current.scale.set(scale, scale, scale);
        }
        birthEmissiveBoostRef.current = 4.0 * (1 - t);
      } else {
        if (groupRef.current) {
          groupRef.current.scale.set(1, 1, 1);
        }
        birthEmissiveBoostRef.current = 0;
        birthStartTime.current = null;
      }
    }

    const t = clock.getElapsedTime() + phaseOffset.current;
    let baseIntensity =
      hovered || selected ? 2.0 : 0.8 + Math.sin(t * 1.5) * 0.2;
    if (isDragSource) baseIntensity = 3.0;
    baseIntensity += birthEmissiveBoostRef.current;

    const mat = meshRef.current.material;
    if ('emissiveIntensity' in mat) {
      (mat as { emissiveIntensity: number }).emissiveIntensity = baseIntensity;
    }

    // Long-press ring animation: shrink from 2x to 1.4x baseRadius over LONG_PRESS_MS
    if (ringRef.current) {
      if (ringStartTime.current !== null) {
        const ringElapsed = performance.now() - ringStartTime.current;
        const progress = Math.min(ringElapsed / LONG_PRESS_MS, 1);
        const ringScale = baseRadius * (2 - 0.6 * progress);
        ringRef.current.scale.set(ringScale, ringScale, 1);
        const ringMat = ringRef.current.material;
        if ('opacity' in ringMat) {
          (ringMat as { opacity: number }).opacity = 0.4 * (1 - progress);
        }
        ringRef.current.visible = true;
        if (progress >= 1) {
          ringStartTime.current = null;
          ringRef.current.visible = false;
        }
      } else {
        ringRef.current.visible = false;
      }
    }
  });

  const handlePointerDown = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    pointerDownTime.current = Date.now();
    isLongPress.current = false;
    ringStartTime.current = performance.now();

    if (onDragLinkStart) {
      longPressTimeout.current = setTimeout(() => {
        isLongPress.current = true;
        onDragLinkStart(node.id, node.position);
      }, 150);
    }
  };

  const handlePointerUp = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    ringStartTime.current = null;

    if (isDragging && onDragLinkEnd) {
      onDragLinkEnd(node.id);
      return;
    }

    if (!isLongPress.current) {
      onClick(node.id);
    }
    isLongPress.current = false;
  };

  const handlePointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    if (!isDragging) {
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
    if (!isDragging) {
      document.body.style.cursor = 'auto';
    }
  };

  const outerOpacity = isDragHoverTarget
    ? 0.3
    : hovered || selected
      ? 0.15
      : 0.06;

  return (
    <group
      position={[node.position.x, node.position.y, node.position.z]}
      scale={birthScale}
    >
      {/* Inner core */}
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[baseRadius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.0}
          toneMapped={false}
        />
      </mesh>

      {/* Outer shell (halo) */}
      <mesh>
        <sphereGeometry args={[baseRadius * 1.4, 32, 32]} />
        <meshBasicMaterial
          color={isDragHoverTarget ? '#4fc3f7' : color}
          transparent
          opacity={outerOpacity}
          depthWrite={false}
        />
      </mesh>

      {/* Long-press closing ring */}
      <mesh ref={ringRef} visible={false} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.9, 1.0, 64]} />
        <meshBasicMaterial
          color="white"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Point light */}
      <pointLight
        ref={lightRef}
        color={color}
        intensity={0.3 + node.data.properties.length * 0.1}
        distance={5}
      />

      {/* Label */}
      <Billboard position={[0, -(baseRadius + 0.5), 0]}>
        <Text
          fontSize={0.35}
          color="white"
          fillOpacity={hovered || selected ? 0.95 : 0.7}
          anchorX="center"
          anchorY="top"
          outlineWidth={0.02}
          outlineColor="#080812"
        >
          {node.data.displayName}
        </Text>
        <Text
          fontSize={0.2}
          color="white"
          fillOpacity={0.35}
          anchorX="center"
          anchorY="top"
          position={[0, -0.4, 0]}
          outlineWidth={0.015}
          outlineColor="#080812"
        >
          {`${node.data.properties.length} props`}
        </Text>
      </Billboard>
    </group>
  );
}

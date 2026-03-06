import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Mesh, PointLight as TPointLight } from 'three';
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
  const lightRef = useRef<TPointLight>(null);
  const [hovered, setHovered] = useState(false);
  const phaseOffset = useRef(Math.random() * Math.PI * 2);

  // Birth animation state
  const birthStartTime = useRef<number | null>(null);
  const [birthScale, setBirthScale] = useState(isBirth ? 0 : 1);
  const [birthEmissiveBoost, setBirthEmissiveBoost] = useState(
    isBirth ? 4.0 : 0,
  );

  // Long-press tracking
  const pointerDownTime = useRef<number>(0);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    if (isBirth) {
      birthStartTime.current = performance.now();
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
        // easeOutBack
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const scale = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        setBirthScale(Math.max(0, scale));
        // Emissive flash: 4.0 → 0 over 0.6s
        setBirthEmissiveBoost(4.0 * (1 - t));
      } else {
        setBirthScale(1);
        setBirthEmissiveBoost(0);
        birthStartTime.current = null;
      }
    }

    const t = clock.getElapsedTime() + phaseOffset.current;
    let baseIntensity =
      hovered || selected ? 2.0 : 0.8 + Math.sin(t * 1.5) * 0.2;
    if (isDragSource) baseIntensity = 3.0;
    baseIntensity += birthEmissiveBoost;

    const mat = meshRef.current.material;
    if ('emissiveIntensity' in mat) {
      (mat as { emissiveIntensity: number }).emissiveIntensity = baseIntensity;
    }
    if (lightRef.current) {
      lightRef.current.intensity =
        hovered || selected
          ? 1.5
          : 0.3 + node.data.properties.length * 0.1;
    }
  });

  const handlePointerDown = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    pointerDownTime.current = Date.now();
    isLongPress.current = false;

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

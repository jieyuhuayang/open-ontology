import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import type { Mesh, PointLight as TPointLight } from 'three';
import type { GraphNode } from '../types';

interface StarNodeProps {
  node: GraphNode;
  onClick: (id: string) => void;
  selected: boolean;
}

export default function StarNode({ node, onClick, selected }: StarNodeProps) {
  const meshRef = useRef<Mesh>(null);
  const lightRef = useRef<TPointLight>(null);
  const [hovered, setHovered] = useState(false);
  const phaseOffset = useRef(Math.random() * Math.PI * 2);

  const baseRadius = 0.5 + node.data.properties.length * 0.08;
  const color = node.data.color;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() + phaseOffset.current;
    const baseIntensity = hovered || selected ? 2.0 : 0.8 + Math.sin(t * 1.5) * 0.2;
    const mat = meshRef.current.material;
    if ('emissiveIntensity' in mat) {
      (mat as { emissiveIntensity: number }).emissiveIntensity = baseIntensity;
    }
    if (lightRef.current) {
      lightRef.current.intensity = hovered || selected ? 1.5 : 0.3 + node.data.properties.length * 0.1;
    }
  });

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Inner core */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
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
          color={color}
          transparent
          opacity={hovered || selected ? 0.15 : 0.06}
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
        >
          {`${node.data.properties.length} props`}
        </Text>
      </Billboard>
    </group>
  );
}

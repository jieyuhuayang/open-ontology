import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorkshopStore } from '../stores/workshop-store';
import type { ShockwaveInstance } from '../types';

interface ShockwaveEffectProps {
  shockwave: ShockwaveInstance;
}

const DURATION = 1.0;
const MAX_SCALE = 3.0;

export default function ShockwaveEffect({ shockwave }: ShockwaveEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const removeShockwave = useWorkshopStore((s) => s.removeShockwave);

  useFrame(({ clock, camera }) => {
    if (!meshRef.current) return;

    const elapsed = clock.elapsedTime - shockwave.startTime;
    const progress = Math.min(elapsed / DURATION, 1.0);

    if (progress >= 1.0) {
      removeShockwave(shockwave.id);
      return;
    }

    // Expand ring
    const scale = progress * MAX_SCALE;
    meshRef.current.scale.setScalar(scale);

    // Fade out
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.6 * (1 - progress);

    // Face camera
    meshRef.current.quaternion.copy(camera.quaternion);
  });

  return (
    <mesh
      ref={meshRef}
      position={[shockwave.position.x, shockwave.position.y, shockwave.position.z]}
    >
      <ringGeometry args={[0.8, 1.0, 32]} />
      <meshBasicMaterial
        color="#4fc3f7"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

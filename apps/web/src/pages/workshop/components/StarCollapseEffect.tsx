import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorkshopStore } from '../stores/workshop-store';
import type { CollapseInstance } from '../types';

interface StarCollapseEffectProps {
  collapse: CollapseInstance;
}

const DURATION = 1.5;
const PARTICLE_COUNT = 40;

export default function StarCollapseEffect({
  collapse,
}: StarCollapseEffectProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const removeCollapse = useWorkshopStore((s) => s.removeCollapse);

  // Generate random directions for particles
  const particleData = useMemo(() => {
    const directions: THREE.Vector3[] = [];
    const speeds: number[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize();
      directions.push(dir);
      speeds.push(1.5 + Math.random() * 2.0);
    }

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const baseColor = new THREE.Color(collapse.color);
    const redColor = new THREE.Color('#ff4d4f');

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    return { directions, speeds, positions, colors, baseColor, redColor };
  }, [collapse.color]);

  useFrame(({ clock, invalidate }) => {
    const elapsed = clock.elapsedTime - collapse.startTime;
    const progress = Math.min(elapsed / DURATION, 1.0);

    if (progress >= 1.0) {
      removeCollapse(collapse.id);
      return;
    }

    // Update particle positions
    if (pointsRef.current) {
      const geo = pointsRef.current.geometry;
      const posAttr = geo.getAttribute('position');
      const colAttr = geo.getAttribute('color');

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const dir = particleData.directions[i]!;
        const speed = particleData.speeds[i]!;
        const dist = progress * speed;

        posAttr.setXYZ(i, dir.x * dist, dir.y * dist, dir.z * dist);

        // Color transition: base → red → dark
        const c = new THREE.Color().lerpColors(
          particleData.baseColor,
          particleData.redColor,
          progress,
        );
        colAttr.setXYZ(i, c.r, c.g, c.b);
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // Fade particles
      const mat = pointsRef.current.material as THREE.PointsMaterial;
      mat.opacity = 1.0 - progress * 0.8;
    }

    // Shrink sphere
    if (sphereRef.current) {
      const s = Math.max(0, 1 - progress * 1.5);
      sphereRef.current.scale.setScalar(s);

      const mat = sphereRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = s * 0.6;
    }
  });

  return (
    <group
      position={[
        collapse.position.x,
        collapse.position.y,
        collapse.position.z,
      ]}
    >
      {/* Shrinking sphere */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color="#ff4d4f"
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Debris particles */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={particleData.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={PARTICLE_COUNT}
            array={particleData.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          vertexColors
          transparent
          opacity={1.0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

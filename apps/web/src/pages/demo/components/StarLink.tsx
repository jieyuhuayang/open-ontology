import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { GraphNode, GraphEdge } from '../types';

interface StarLinkProps {
  edge: GraphEdge;
  sourceNode: GraphNode;
  targetNode: GraphNode;
}

function computeBezierPoints(
  src: THREE.Vector3,
  tgt: THREE.Vector3,
  segments = 48,
): THREE.Vector3[] {
  const mid = new THREE.Vector3().addVectors(src, tgt).multiplyScalar(0.5);
  // Elevate control point perpendicular to the source→target vector
  const dir = new THREE.Vector3().subVectors(tgt, src);
  const up = new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3().crossVectors(dir, up).normalize();
  if (perp.length() < 0.01) perp.set(1, 0, 0);
  const elevation = dir.length() * 0.25;
  const control = mid.clone().add(perp.clone().multiplyScalar(elevation));

  const curve = new THREE.QuadraticBezierCurve3(src, control, tgt);
  return curve.getPoints(segments);
}

const PARTICLE_COUNT = 8;

export default function StarLink({ edge, sourceNode, targetNode }: StarLinkProps) {
  const src = useMemo(
    () => new THREE.Vector3(sourceNode.position.x, sourceNode.position.y, sourceNode.position.z),
    [sourceNode.position.x, sourceNode.position.y, sourceNode.position.z],
  );
  const tgt = useMemo(
    () => new THREE.Vector3(targetNode.position.x, targetNode.position.y, targetNode.position.z),
    [targetNode.position.x, targetNode.position.y, targetNode.position.z],
  );

  const bezierPoints = useMemo(() => computeBezierPoints(src, tgt), [src, tgt]);
  const midPoint = useMemo(() => bezierPoints[Math.floor(bezierPoints.length / 2)]!, [bezierPoints]);

  // Particle system
  const particlesRef = useRef<THREE.Points>(null);
  const particlePhases = useRef<number[]>(
    Array.from({ length: PARTICLE_COUNT }, () => Math.random()),
  );
  const particleSpeeds = useRef<number[]>(
    Array.from({ length: PARTICLE_COUNT }, () => 0.08 + Math.random() * 0.12),
  );

  const particlePositions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useFrame(() => {
    if (!particlesRef.current) return;
    const phases = particlePhases.current;
    const speeds = particleSpeeds.current;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      phases[i] = ((phases[i] ?? 0) + (speeds[i] ?? 0.1) * 0.01) % 1;
      const t = phases[i] ?? 0;
      const idx = Math.floor(t * (bezierPoints.length - 1));
      const point = bezierPoints[idx];
      if (point) {
        const offset = (Math.sin(t * 20 + i) * 0.05);
        particlePositions[i * 3] = point.x + offset;
        particlePositions[i * 3 + 1] = point.y + offset;
        particlePositions[i * 3 + 2] = point.z + offset;
      }
    }

    const geom = particlesRef.current.geometry;
    geom.attributes['position']!.needsUpdate = true;
  });

  return (
    <group>
      <Line
        points={bezierPoints}
        color="white"
        opacity={0.12}
        transparent
        lineWidth={1.5}
        dashed
        dashSize={0.3}
        dashScale={1}
        gapSize={0.15}
      />

      {/* Flowing particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          color="white"
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Label at midpoint */}
      <Billboard position={[midPoint.x, midPoint.y + 0.3, midPoint.z]}>
        <Text fontSize={0.22} color="white" fillOpacity={0.45} anchorX="center" anchorY="bottom">
          {`${edge.data.label} (${edge.data.cardinality})`}
        </Text>
      </Billboard>
    </group>
  );
}

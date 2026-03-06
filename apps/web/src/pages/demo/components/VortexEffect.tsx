import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import type { IngestionPhase, GraphNode } from '../types';

interface VortexEffectProps {
  phase: IngestionPhase;
  fileName: string | null;
  targetNodes: GraphNode[];
}

const PARTICLE_COUNT = 200;

const phaseMessages: Record<string, string> = {
  ABSORBING: 'demo.phaseAbsorbing',
  PROCESSING: 'demo.phaseProcessing',
  CRYSTALLIZING: 'demo.phaseCrystallizing',
};

export default function VortexEffect({ phase, fileName, targetNodes }: VortexEffectProps) {
  const { t } = useTranslation();
  const pointsRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const startTime = useRef(Date.now());
  const prevPhase = useRef(phase);

  if (prevPhase.current !== phase) {
    startTime.current = Date.now();
    prevPhase.current = phase;
  }

  // Initialize particle data with per-particle sizes
  const { positions, sizes, shaderMaterial } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const sz = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 8 + Math.random() * 7;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      sz[i] = 0.05 + Math.random() * 0.09;
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color('#88bbff') },
        opacity: { value: 0.8 },
      },
      vertexShader: `
        attribute float size;
        varying float vAlpha;
        void main() {
          vAlpha = 1.0;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = opacity * (1.0 - smoothstep(0.3, 0.5, d));
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { positions: pos, sizes: sz, shaderMaterial: mat };
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    const time = clock.getElapsedTime();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      if (phase === 'ABSORBING') {
        // Spiral inward toward origin
        const px = positions[ix]!;
        const py = positions[iy]!;
        const pz = positions[iz]!;
        const dist = Math.sqrt(px * px + py * py + pz * pz);
        const pullStrength = 0.02 + elapsed * 0.01;
        // Tangential rotation
        const angle = 0.03 + (1 / (dist + 0.5)) * 0.05;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const nx = px * cosA - pz * sinA;
        const nz = px * sinA + pz * cosA;
        // Pull toward center
        const factor = Math.max(0, 1 - pullStrength / (dist + 0.1));
        positions[ix] = nx * factor;
        positions[iy] = py * factor * 0.99;
        positions[iz] = nz * factor;
      } else if (phase === 'PROCESSING') {
        // Tight orbit at radius ~1.5
        const targetR = 1.5;
        const speed = 2 + (i % 5) * 0.5;
        const orbitAngle = time * speed + (i / PARTICLE_COUNT) * Math.PI * 2;
        const verticalSpread = Math.sin(i * 0.7) * 0.5;
        positions[ix] = Math.cos(orbitAngle) * targetR;
        positions[iy] = verticalSpread;
        positions[iz] = Math.sin(orbitAngle) * targetR;
      } else if (phase === 'CRYSTALLIZING') {
        // Shoot outward to target node positions
        const progress = Math.min(elapsed / 2.0, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const targetNode = targetNodes[i % targetNodes.length];
        if (targetNode) {
          const tx = targetNode.position.x;
          const ty = targetNode.position.y;
          const tz = targetNode.position.z;
          positions[ix] = eased * tx;
          positions[iy] = eased * ty;
          positions[iz] = eased * tz;
        }
      }
    }

    pointsRef.current.geometry.attributes['position']!.needsUpdate = true;

    // Animate center light
    if (lightRef.current) {
      if (phase === 'ABSORBING') {
        lightRef.current.intensity = 0.5 + elapsed * 0.5;
        lightRef.current.color.set('#4488ff');
      } else if (phase === 'PROCESSING') {
        lightRef.current.intensity = 3 + Math.sin(time * 4) * 1;
        lightRef.current.color.set('#6699ff');
      } else if (phase === 'CRYSTALLIZING') {
        const progress = Math.min(elapsed / 2.0, 1);
        lightRef.current.intensity = 3 * (1 - progress);
      }
    }
  });

  if (phase === 'IDLE' || phase === 'COMPLETE') return null;

  const messageKey = phaseMessages[phase];

  return (
    <group>
      <points ref={pointsRef} material={shaderMaterial}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={PARTICLE_COUNT}
            array={sizes}
            itemSize={1}
          />
        </bufferGeometry>
      </points>

      <pointLight ref={lightRef} position={[0, 0, 0]} intensity={1} distance={20} />

      {/* Processing rings */}
      {phase === 'PROCESSING' && (
        <>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.8 + i * 0.8, 1.85 + i * 0.8, 64]} />
              <meshBasicMaterial
                color="#4488ff"
                transparent
                opacity={0.15 - i * 0.04}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </>
      )}

      {/* Status text overlay */}
      <Html center position={[0, -3, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 14,
          whiteSpace: 'nowrap',
          fontFamily: 'Geist, system-ui, sans-serif',
          textAlign: 'center',
        }}>
          {messageKey ? t(messageKey) : ''}
          {phase === 'ABSORBING' && fileName && (
            <span style={{ opacity: 0.5, marginLeft: 8 }}>{fileName}</span>
          )}
        </div>
      </Html>
    </group>
  );
}

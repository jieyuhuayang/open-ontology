import { Stars } from '@react-three/drei';

export default function BackgroundStars() {
  return (
    <>
      <Stars
        radius={100}
        depth={60}
        count={1500}
        factor={4}
        saturation={0.2}
        fade
        speed={0.5}
      />
      {/* Subtle nebula glow at the background */}
      <mesh position={[0, 0, -50]}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color="#1a0a2e" transparent opacity={0.15} />
      </mesh>
    </>
  );
}

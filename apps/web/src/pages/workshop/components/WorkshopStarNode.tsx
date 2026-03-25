import { useRef, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { WorkshopNode } from '../types';

// Fresnel + vertex noise shader
const fresnelVertexShader = /* glsl */ `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  // Simplex-like hash noise
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3(i), f),
                       dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }

  void main() {
    vUv = uv;
    // Vertex noise displacement
    vec3 displaced = position + normal * noise3D(position * 2.0 + time * 0.3) * 0.05;
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fresnelFragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  uniform vec3 emissiveColor;
  uniform float emissiveIntensity;
  uniform float fresnelPower;
  uniform float fresnelIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float fresnel = pow(1.0 - max(dot(vViewDir, vNormal), 0.0), fresnelPower);
    vec3 base = color * 0.6 + emissiveColor * emissiveIntensity;
    vec3 fresnelContrib = vec3(1.0) * fresnel * fresnelIntensity;
    gl_FragColor = vec4(base + fresnelContrib, opacity);
  }
`;

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

  const { gl } = useThree();
  const supportsWebGL2 = gl.capabilities.isWebGL2;

  const shaderUniforms = useMemo(
    () => ({
      time: { value: 0 },
      color: { value: new THREE.Color(node.color) },
      opacity: { value: getOpacity(node) },
      emissiveColor: { value: new THREE.Color(node.color) },
      emissiveIntensity: { value: getEmissiveIntensity(node) },
      fresnelPower: { value: 2.0 },
      fresnelIntensity: { value: 0.8 },
    }),
    // Only recreate on node identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id],
  );

  const needsAnimation = node.status === 'pending' && node.confidenceLevel === 'low';
  const needsGlowPulse = isSelected || isHovered || isHighlighted;

  // Animate — only request frames when animation is active
  useFrame(({ clock, invalidate }) => {
    // Update shader time (drives vertex noise displacement)
    shaderUniforms.time.value = clock.elapsedTime;

    // Update opacity for low-confidence flicker
    if (needsAnimation) {
      const flicker =
        0.3 + 0.15 * Math.sin(clock.elapsedTime * 3 + node.id.length);
      shaderUniforms.opacity.value = flicker;
      invalidate();
    }

    // Glow pulse only when interactive state is active
    if (glowRef.current && needsGlowPulse) {
      if (isHighlighted) {
        const pulse = 2.2 + 0.15 * Math.sin(clock.elapsedTime * 5);
        glowRef.current.scale.setScalar(pulse);
      } else {
        const baseScale = isSelected || isHovered ? 1.8 : 1.4;
        const pulse = baseScale + 0.1 * Math.sin(clock.elapsedTime * 2);
        glowRef.current.scale.setScalar(pulse);
      }
      invalidate();
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
        {supportsWebGL2 ? (
          <shaderMaterial
            vertexShader={fresnelVertexShader}
            fragmentShader={fresnelFragmentShader}
            uniforms={shaderUniforms}
            transparent
          />
        ) : (
          <meshStandardMaterial
            color={node.color}
            emissive={node.color}
            emissiveIntensity={emissiveIntensity}
            transparent
            opacity={opacity}
          />
        )}
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
      <Billboard position={[0, 0.9, 0]}>
        <Text
          fontSize={0.28}
          color="rgba(255,255,255,0.85)"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {node.displayName}
        </Text>
      </Billboard>

      {/* AI badge for pending items */}
      {node.status === 'pending' && (
        <Billboard position={[0, -0.8, 0]}>
          <Text
            fontSize={0.22}
            color="#ffc53d"
            anchorX="center"
            anchorY="middle"
          >
            AI
          </Text>
        </Billboard>
      )}
    </group>
  );
}

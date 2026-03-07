import { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type * as THREE from 'three';
import BackgroundStars from './BackgroundStars';
import StarNode from './StarNode';
import StarLink from './StarLink';
import VortexEffect from './VortexEffect';
import DragLinkLine from './DragLinkLine';
import type {
  GraphNode,
  GraphEdge,
  IngestionPhase,
  DragLinkState,
} from '../types';

interface OrbitControlsHandle {
  object: THREE.Camera & { position: THREE.Vector3 };
  target: THREE.Vector3;
  update: () => void;
}

export interface StarfieldCanvasHandle {
  controls: OrbitControlsHandle | null;
}

interface StarfieldCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  phase: IngestionPhase;
  fileName: string | null;
  selectedNodeId: string | null;
  onNodeClick: (id: string) => void;
  dragLink?: DragLinkState | null;
  onDragLinkStart?: (
    nodeId: string,
    position: { x: number; y: number; z: number },
  ) => void;
  onDragLinkEnd?: (nodeId: string | undefined) => void;
  onDragPointerMove?: (position: {
    x: number;
    y: number;
    z: number;
  }) => void;
  orbitEnabled?: boolean;
  birthNodeId?: string | null;
}

function DragPlane({
  onPointerMove,
  onPointerUp,
}: {
  onPointerMove: (point: { x: number; y: number; z: number }) => void;
  onPointerUp: () => void;
}) {
  const { camera } = useThree();

  return (
    <mesh
      position={[0, 0, 0]}
      rotation={camera.rotation}
      onPointerMove={(e) => {
        e.stopPropagation();
        onPointerMove({ x: e.point.x, y: e.point.y, z: e.point.z });
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onPointerUp();
      }}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

function SceneContent({
  nodes,
  edges,
  phase,
  fileName,
  selectedNodeId,
  onNodeClick,
  controlsRef,
  dragLink,
  onDragLinkStart,
  onDragLinkEnd,
  onDragPointerMove,
  orbitEnabled = true,
  birthNodeId,
}: StarfieldCanvasProps & {
  controlsRef: React.RefObject<OrbitControlsHandle | null>;
}) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const showVortex = phase !== 'IDLE' && phase !== 'COMPLETE';
  const isDragging = dragLink !== null;

  const handleDragPointerMove = useCallback(
    (point: { x: number; y: number; z: number }) => {
      onDragPointerMove?.(point);
    },
    [onDragPointerMove],
  );

  const handleDragPointerUp = useCallback(() => {
    onDragLinkEnd?.(undefined);
  }, [onDragLinkEnd]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <fog attach="fog" args={['#080812', 30, 80]} />

      <OrbitControls
        ref={controlsRef as React.RefObject<never>}
        enabled={orbitEnabled}
        autoRotate={!isDragging && orbitEnabled}
        autoRotateSpeed={0.15}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
      />

      <BackgroundStars />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.25}
          luminanceSmoothing={0.9}
          intensity={1.3}
        />
      </EffectComposer>

      {/* Star nodes */}
      {nodes.map((node) => (
        <StarNode
          key={node.id}
          node={node}
          onClick={onNodeClick}
          selected={selectedNodeId === node.id}
          isBirth={birthNodeId === node.id}
          onDragLinkStart={onDragLinkStart}
          onDragLinkEnd={(nodeId) => onDragLinkEnd?.(nodeId)}
          isDragSource={dragLink?.sourceNodeId === node.id}
          isDragHoverTarget={dragLink?.hoveredTargetId === node.id}
          isDragging={isDragging}
        />
      ))}

      {/* Star links */}
      {edges.map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) return null;
        return (
          <StarLink
            key={edge.id}
            edge={edge}
            sourceNode={sourceNode}
            targetNode={targetNode}
          />
        );
      })}

      {/* Drag link line */}
      {dragLink && <DragLinkLine dragLink={dragLink} />}

      {/* Drag capture plane */}
      {isDragging && (
        <DragPlane
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
        />
      )}

      {/* Ingestion vortex */}
      {showVortex && (
        <VortexEffect phase={phase} fileName={fileName} targetNodes={nodes} />
      )}
    </>
  );
}

const StarfieldCanvas = forwardRef<StarfieldCanvasHandle, StarfieldCanvasProps>(
  function StarfieldCanvas(props, ref) {
    const controlsRef = useRef<OrbitControlsHandle | null>(null);

    useImperativeHandle(ref, () => ({
      get controls() {
        return controlsRef.current;
      },
    }));

    return (
      <Canvas
        camera={{ position: [0, 0, 20], fov: 60 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#080812');
        }}
      >
        <SceneContent {...props} controlsRef={controlsRef} />
      </Canvas>
    );
  },
);

export default StarfieldCanvas;

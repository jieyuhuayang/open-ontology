import { useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
type OrbitControlsImpl = InstanceType<typeof import('@react-three/drei').OrbitControls extends React.ForwardRefExoticComponent<infer P> ? never : never> & {
  object: import('three').Camera;
  target: import('three').Vector3;
  update: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrbitControlsRef = any;
import BackgroundStars from './BackgroundStars';
import StarNode from './StarNode';
import StarLink from './StarLink';
import VortexEffect from './VortexEffect';
import type { GraphNode, GraphEdge, IngestionPhase } from '../types';

export interface StarfieldCanvasHandle {
  controls: OrbitControlsImpl | null;
}

interface StarfieldCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  phase: IngestionPhase;
  fileName: string | null;
  selectedNodeId: string | null;
  onNodeClick: (id: string) => void;
}

function SceneContent({
  nodes,
  edges,
  phase,
  fileName,
  selectedNodeId,
  onNodeClick,
  controlsRef,
}: StarfieldCanvasProps & { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const showVortex = phase !== 'IDLE' && phase !== 'COMPLETE';

  return (
    <>
      <ambientLight intensity={0.15} />
      <fog attach="fog" args={['#080812', 30, 80]} />

      <OrbitControls
        ref={controlsRef}
        autoRotate
        autoRotateSpeed={0.15}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
      />

      <BackgroundStars />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          intensity={1.8}
        />
      </EffectComposer>

      {/* Star nodes */}
      {nodes.map((node) => (
        <StarNode
          key={node.id}
          node={node}
          onClick={onNodeClick}
          selected={selectedNodeId === node.id}
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

      {/* Ingestion vortex */}
      {showVortex && (
        <VortexEffect phase={phase} fileName={fileName} targetNodes={nodes} />
      )}
    </>
  );
}

const StarfieldCanvas = forwardRef<StarfieldCanvasHandle, StarfieldCanvasProps>(
  function StarfieldCanvas(props, ref) {
    const controlsRef = useRef<OrbitControlsImpl | null>(null);

    useImperativeHandle(ref, () => ({
      get controls() {
        return controlsRef.current;
      },
    }));

    return (
      <Canvas
        camera={{ position: [0, 0, 20], fov: 60 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true, alpha: false }}
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

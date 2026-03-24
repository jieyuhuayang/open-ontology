import { useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type * as THREE from 'three';
import WorkshopStarNode from './WorkshopStarNode';
import WorkshopStarLink from './WorkshopStarLink';
import { useWorkshopStore } from '../stores/workshop-store';
import type { WorkshopNode, WorkshopEdge } from '../types';

interface OrbitControlsRef {
  object: THREE.Camera;
  target: THREE.Vector3;
  update: () => void;
  reset: () => void;
}

export interface WorkshopCanvasHandle {
  fitView: () => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface WorkshopCanvasProps {
  nodes: WorkshopNode[];
  edges: WorkshopEdge[];
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
}

function SceneContent({
  nodes,
  edges,
  controlsRef,
  onNodeClick,
  onNodeDoubleClick,
}: WorkshopCanvasProps & { controlsRef: React.RefObject<OrbitControlsRef | null> }) {
  const selectedEntityRid = useWorkshopStore((s) => s.selectedEntityRid);
  const hoveredEntityRid = useWorkshopStore((s) => s.hoveredEntityRid);
  const setHoveredEntityRid = useWorkshopStore((s) => s.setHoveredEntityRid);
  const setSelectedEntityRid = useWorkshopStore((s) => s.setSelectedEntityRid);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />

      <OrbitControls
        ref={controlsRef as React.RefObject<OrbitControlsRef>}
        enablePan
        enableRotate
        enableZoom
        dampingFactor={0.1}
        enableDamping
      />

      <Stars
        radius={100}
        depth={80}
        count={3000}
        factor={4}
        saturation={0}
        fade
      />

      {nodes
        .filter((n) => n.type === 'object_type')
        .map((node) => (
          <WorkshopStarNode
            key={node.id}
            node={node}
            isSelected={selectedEntityRid === node.id}
            isHovered={hoveredEntityRid === node.id}
            onPointerOver={() => setHoveredEntityRid(node.id)}
            onPointerOut={() => setHoveredEntityRid(null)}
            onClick={() => {
              setSelectedEntityRid(node.id);
              onNodeClick?.(node.id);
            }}
            onDoubleClick={() => onNodeDoubleClick?.(node.id)}
          />
        ))}

      {edges.map((edge) => (
        <WorkshopStarLink
          key={edge.id}
          edge={edge}
          sourceNode={nodeMap.get(edge.sourceNodeId)}
          targetNode={nodeMap.get(edge.targetNodeId)}
        />
      ))}

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.8}
        />
      </EffectComposer>
    </>
  );
}

const WorkshopCanvas = forwardRef<WorkshopCanvasHandle, WorkshopCanvasProps>(
  function WorkshopCanvas({ nodes, edges, onNodeClick, onNodeDoubleClick }, ref) {
    const controlsRef = useRef<OrbitControlsRef>(null);

    const fitView = useCallback(() => {
      if (!controlsRef.current) return;
      const cam = controlsRef.current.object as THREE.PerspectiveCamera;
      cam.position.set(0, 0, 20);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }, []);

    const resetCamera = useCallback(() => {
      if (!controlsRef.current) return;
      const cam = controlsRef.current.object as THREE.PerspectiveCamera;
      cam.position.set(0, 5, 15);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }, []);

    const zoomIn = useCallback(() => {
      if (!controlsRef.current) return;
      const cam = controlsRef.current.object as THREE.PerspectiveCamera;
      cam.position.multiplyScalar(0.8);
      controlsRef.current.update();
    }, []);

    const zoomOut = useCallback(() => {
      if (!controlsRef.current) return;
      const cam = controlsRef.current.object as THREE.PerspectiveCamera;
      cam.position.multiplyScalar(1.25);
      controlsRef.current.update();
    }, []);

    useImperativeHandle(ref, () => ({ fitView, resetCamera, zoomIn, zoomOut }));

    return (
      <Canvas
        camera={{ position: [0, 5, 15], fov: 60, near: 0.1, far: 2000 }}
        style={{ background: '#0a0a1a' }}
        data-testid="workshop-canvas"
      >
        <SceneContent
          nodes={nodes}
          edges={edges}
          controlsRef={controlsRef}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
        />
      </Canvas>
    );
  },
);

export default WorkshopCanvas;

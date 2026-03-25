import { useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import WorkshopStarNode from './WorkshopStarNode';
import WorkshopStarLink from './WorkshopStarLink';
import DragLinkLine from './DragLinkLine';
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
  focusOnEntity?: (position: { x: number; y: number; z: number }) => void;
}

interface WorkshopCanvasProps {
  nodes: WorkshopNode[];
  edges: WorkshopEdge[];
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onLinkCreate?: (sourceId: string, targetId: string) => void;
}

/** Invisible plane for raycasting drag pointer position */
function DragPlane() {
  const { camera } = useThree();
  const planeRef = useRef<THREE.Mesh>(null);
  const dragLinkState = useWorkshopStore((s) => s.dragLinkState);
  const setDragLinkState = useWorkshopStore((s) => s.setDragLinkState);
  const clearDragLink = useWorkshopStore((s) => s.clearDragLink);

  const handlePointerMove = useCallback(
    (e: THREE.Event) => {
      if (!dragLinkState) return;
      e.stopPropagation();
      const point = (e as unknown as { point: THREE.Vector3 }).point;
      setDragLinkState({
        ...dragLinkState,
        currentPointerPosition: { x: point.x, y: point.y, z: point.z },
      });
    },
    [dragLinkState, setDragLinkState],
  );

  const handlePointerUp = useCallback(() => {
    clearDragLink();
  }, [clearDragLink]);

  if (!dragLinkState) return null;

  // Orient plane to face camera
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);

  return (
    <mesh
      ref={planeRef}
      position={[0, 0, 0]}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      visible={false}
      quaternion={camera.quaternion}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SceneContent({
  nodes,
  edges,
  controlsRef,
  onNodeClick,
  onNodeDoubleClick,
  onLinkCreate,
}: WorkshopCanvasProps & { controlsRef: React.RefObject<OrbitControlsRef | null> }) {
  const selectedEntityRid = useWorkshopStore((s) => s.selectedEntityRid);
  const hoveredEntityRid = useWorkshopStore((s) => s.hoveredEntityRid);
  const highlightedEntityRids = useWorkshopStore((s) => s.highlightedEntityRids);
  const setHoveredEntityRid = useWorkshopStore((s) => s.setHoveredEntityRid);
  const setSelectedEntityRid = useWorkshopStore((s) => s.setSelectedEntityRid);
  const setFocusedEntityRid = useWorkshopStore((s) => s.setFocusedEntityRid);
  const clearFocusLock = useWorkshopStore((s) => s.clearFocusLock);
  const dragLinkState = useWorkshopStore((s) => s.dragLinkState);
  const setDragLinkState = useWorkshopStore((s) => s.setDragLinkState);
  const clearDragLink = useWorkshopStore((s) => s.clearDragLink);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const handleDragStart = useCallback(
    (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      setDragLinkState({
        sourceNodeId: nodeId,
        sourcePosition: { ...node.position },
        currentPointerPosition: { ...node.position },
        hoveredTargetId: null,
      });
    },
    [nodeMap, setDragLinkState],
  );

  const handleDragHoverEnter = useCallback(
    (nodeId: string) => {
      if (!dragLinkState) return;
      if (nodeId === dragLinkState.sourceNodeId) return;
      setDragLinkState({ ...dragLinkState, hoveredTargetId: nodeId });
    },
    [dragLinkState, setDragLinkState],
  );

  const handleDragHoverLeave = useCallback(() => {
    if (!dragLinkState) return;
    setDragLinkState({ ...dragLinkState, hoveredTargetId: null });
  }, [dragLinkState, setDragLinkState]);

  const handleNodePointerUp = useCallback(
    (nodeId: string) => {
      if (!dragLinkState) return;
      if (nodeId !== dragLinkState.sourceNodeId && dragLinkState.hoveredTargetId === nodeId) {
        onLinkCreate?.(dragLinkState.sourceNodeId, nodeId);
      }
      clearDragLink();
    },
    [dragLinkState, clearDragLink, onLinkCreate],
  );

  // Click empty space → clear focus lock
  const handlePointerMissed = useCallback(() => {
    setSelectedEntityRid(null);
    clearFocusLock();
  }, [setSelectedEntityRid, clearFocusLock]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />

      <OrbitControls
        ref={controlsRef as React.RefObject<OrbitControlsRef>}
        enablePan
        enableRotate={!dragLinkState}
        enableZoom
        dampingFactor={0.1}
        enableDamping
      />

      <Stars
        radius={100}
        depth={80}
        count={1500}
        factor={4}
        saturation={0}
        fade
      />

      {/* Invisible background to catch pointer-missed */}
      <mesh
        position={[0, 0, -50]}
        onClick={handlePointerMissed}
        visible={false}
      >
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {nodes
        .filter((n) => n.type === 'object_type')
        .map((node) => (
          <WorkshopStarNode
            key={node.id}
            node={node}
            isSelected={selectedEntityRid === node.id}
            isHovered={hoveredEntityRid === node.id}
            isHighlighted={highlightedEntityRids.includes(node.id)}
            isDragSource={dragLinkState?.sourceNodeId === node.id}
            onPointerOver={() => setHoveredEntityRid(node.id)}
            onPointerOut={() => setHoveredEntityRid(null)}
            onClick={() => {
              setSelectedEntityRid(node.id);
              setFocusedEntityRid(node.id);
              onNodeClick?.(node.id);
            }}
            onDoubleClick={() => onNodeDoubleClick?.(node.id)}
            onDragStart={handleDragStart}
            onDragHoverEnter={handleDragHoverEnter}
            onDragHoverLeave={handleDragHoverLeave}
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

      {/* Drag link line */}
      {dragLinkState && <DragLinkLine dragLink={dragLinkState} />}

      {/* Invisible drag plane for pointer tracking */}
      <DragPlane />

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

/** Camera lerp animation component — renders inside Canvas */
function CameraAnimator({
  targetRef,
  controlsRef,
}: {
  targetRef: React.RefObject<THREE.Vector3 | null>;
  controlsRef: React.RefObject<OrbitControlsRef | null>;
}) {
  useFrame(({ camera }) => {
    if (!targetRef.current || !controlsRef.current) return;
    camera.position.lerp(targetRef.current, 0.06);
    controlsRef.current.update();
    if (camera.position.distanceTo(targetRef.current) < 0.1) {
      (targetRef as React.MutableRefObject<THREE.Vector3 | null>).current = null;
    }
  });
  return null;
}

const WorkshopCanvas = forwardRef<WorkshopCanvasHandle, WorkshopCanvasProps>(
  function WorkshopCanvas({ nodes, edges, onNodeClick, onNodeDoubleClick, onLinkCreate }, ref) {
    const controlsRef = useRef<OrbitControlsRef>(null);
    const cameraTargetRef = useRef<THREE.Vector3 | null>(null);

    const fitView = useCallback(() => {
      cameraTargetRef.current = new THREE.Vector3(0, 0, 20);
    }, []);

    const resetCamera = useCallback(() => {
      cameraTargetRef.current = new THREE.Vector3(0, 5, 15);
    }, []);

    const zoomIn = useCallback(() => {
      if (!controlsRef.current) return;
      const cam = controlsRef.current.object as THREE.PerspectiveCamera;
      cameraTargetRef.current = cam.position.clone().multiplyScalar(0.8);
    }, []);

    const zoomOut = useCallback(() => {
      if (!controlsRef.current) return;
      const cam = controlsRef.current.object as THREE.PerspectiveCamera;
      cameraTargetRef.current = cam.position.clone().multiplyScalar(1.25);
    }, []);

    const focusOnEntity = useCallback(
      (position: { x: number; y: number; z: number }) => {
        cameraTargetRef.current = new THREE.Vector3(
          position.x,
          position.y + 2,
          position.z + 5,
        );
      },
      [],
    );

    useImperativeHandle(ref, () => ({
      fitView,
      resetCamera,
      zoomIn,
      zoomOut,
      focusOnEntity,
    }));

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
          onLinkCreate={onLinkCreate}
        />
        <CameraAnimator targetRef={cameraTargetRef} controlsRef={controlsRef} />
      </Canvas>
    );
  },
);

export default WorkshopCanvas;

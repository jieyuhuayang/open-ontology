import { useRef, useCallback, useEffect } from 'react';
import { useWorkshopStore } from '../stores/workshop-store';
import WorkshopCanvas from './WorkshopCanvas';
import WorkshopToolbar from './WorkshopToolbar';
import Workshop2DView from './Workshop2DView';
import type { WorkshopCanvasHandle } from './WorkshopCanvas';
import type { Workshop2DViewHandle } from './Workshop2DView';
import type { WorkshopNode, WorkshopEdge } from '../types';

interface StarfieldWorkbenchProps {
  nodes: WorkshopNode[];
  edges: WorkshopEdge[];
  onLinkCreate?: (sourceId: string, targetId: string) => void;
}

export default function StarfieldWorkbench({
  nodes,
  edges,
  onLinkCreate,
}: StarfieldWorkbenchProps) {
  const canvasRef = useRef<WorkshopCanvasHandle>(null);
  const view2DRef = useRef<Workshop2DViewHandle>(null);
  const viewMode = useWorkshopStore((s) => s.viewMode);
  const clearDragLink = useWorkshopStore((s) => s.clearDragLink);
  const setSelectedEntityRid = useWorkshopStore(
    (s) => s.setSelectedEntityRid,
  );

  // Clear drag state when switching away from 3D
  useEffect(() => {
    if (viewMode === '2d') {
      clearDragLink();
    }
  }, [viewMode, clearDragLink]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedEntityRid(nodeId);
    },
    [setSelectedEntityRid],
  );

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node?.status === 'confirmed') {
        window.open(`/object-types/${nodeId}`, '_blank');
      }
    },
    [nodes],
  );

  // Toolbar callbacks depend on active view
  const handleFitView = useCallback(() => {
    if (viewMode === '3d') {
      canvasRef.current?.fitView();
    } else {
      view2DRef.current?.fitView();
    }
  }, [viewMode]);

  const handleResetCamera = useCallback(() => {
    if (viewMode === '3d') {
      canvasRef.current?.resetCamera();
    } else {
      view2DRef.current?.resetView();
    }
  }, [viewMode]);

  const handleZoomIn = useCallback(() => {
    if (viewMode === '3d') {
      canvasRef.current?.zoomIn();
    } else {
      view2DRef.current?.zoomIn();
    }
  }, [viewMode]);

  const handleZoomOut = useCallback(() => {
    if (viewMode === '3d') {
      canvasRef.current?.zoomOut();
    } else {
      view2DRef.current?.zoomOut();
    }
  }, [viewMode]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      data-testid="starfield-workbench"
    >
      {viewMode === '3d' ? (
        <WorkshopCanvas
          ref={canvasRef}
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onLinkCreate={onLinkCreate}
        />
      ) : (
        <Workshop2DView ref={view2DRef} nodes={nodes} edges={edges} />
      )}
      <WorkshopToolbar
        onFitView={handleFitView}
        onResetCamera={handleResetCamera}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        nodeCount={nodes.length}
      />
    </div>
  );
}

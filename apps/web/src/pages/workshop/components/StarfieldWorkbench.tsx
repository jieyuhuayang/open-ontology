import { useRef, useCallback } from 'react';
import { useWorkshopStore } from '../stores/workshop-store';
import WorkshopCanvas from './WorkshopCanvas';
import WorkshopToolbar from './WorkshopToolbar';
import type { WorkshopCanvasHandle } from './WorkshopCanvas';
import type { WorkshopNode, WorkshopEdge } from '../types';

interface StarfieldWorkbenchProps {
  nodes: WorkshopNode[];
  edges: WorkshopEdge[];
}

export default function StarfieldWorkbench({
  nodes,
  edges,
}: StarfieldWorkbenchProps) {
  const canvasRef = useRef<WorkshopCanvasHandle>(null);
  const setSelectedEntityRid = useWorkshopStore(
    (s) => s.setSelectedEntityRid,
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedEntityRid(nodeId);
    },
    [setSelectedEntityRid],
  );

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node?.status === 'confirmed') {
      window.open(`/object-types/${nodeId}`, '_blank');
    }
  }, [nodes]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      data-testid="starfield-workbench"
    >
      <WorkshopCanvas
        ref={canvasRef}
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
      />
      <WorkshopToolbar
        onFitView={() => canvasRef.current?.fitView()}
        onResetCamera={() => canvasRef.current?.resetCamera()}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
      />
    </div>
  );
}

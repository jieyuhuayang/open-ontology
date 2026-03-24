import { useRef, useCallback } from 'react';
import { useWorkshopGraph } from '../hooks/use-workshop-graph';
import { useWorkshopStore } from '../stores/workshop-store';
import WorkshopCanvas from './WorkshopCanvas';
import WorkshopToolbar from './WorkshopToolbar';
import type { WorkshopCanvasHandle } from './WorkshopCanvas';

interface StarfieldWorkbenchProps {
  ontologyRid: string;
  blueprintRid: string | null;
}

export default function StarfieldWorkbench({
  ontologyRid,
  blueprintRid,
}: StarfieldWorkbenchProps) {
  const canvasRef = useRef<WorkshopCanvasHandle>(null);
  const setSelectedEntityRid = useWorkshopStore(
    (s) => s.setSelectedEntityRid,
  );

  const { nodes, edges } = useWorkshopGraph(ontologyRid, blueprintRid);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedEntityRid(nodeId);
    },
    [setSelectedEntityRid],
  );

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    // Only navigate for confirmed entities
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

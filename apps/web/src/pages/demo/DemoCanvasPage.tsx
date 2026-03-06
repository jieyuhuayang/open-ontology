import { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import DemoHeader from './components/DemoHeader';
import StarfieldCanvas from './components/StarfieldCanvas';
import type { StarfieldCanvasHandle } from './components/StarfieldCanvas';
import IngestionDropZone from './components/IngestionDropZone';
import AgentSidekick from './components/AgentSidekick';
import CanvasToolbar from './components/CanvasToolbar';
import NodeDetailPanel from './components/NodeDetailPanel';
import { useDemoGraph } from './hooks/use-demo-graph';
import { useIngestion } from './hooks/use-ingestion';
import { useAgentSuggestions } from './hooks/use-agent-suggestions';
import { reviewLinks } from './mock/mock-suggestions';
import type { DemoObjectType, DemoLinkType } from './types';
import styles from './styles/canvas.module.css';

export function Component() {
  const canvasRef = useRef<StarfieldCanvasHandle>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const {
    nodes,
    edges,
    crystallizeFromMock,
    addNode,
    addLink,
    addPropertyToNode,
    toggleNodeExpanded,
    selectedNodeId,
    setSelectedNodeId,
  } = useDemoGraph();

  const handleIngestionComplete = useCallback(
    (objectTypes: DemoObjectType[], linkTypes: DemoLinkType[]) => {
      crystallizeFromMock(objectTypes, linkTypes);
      setCanvasReady(true);
    },
    [crystallizeFromMock],
  );

  const { phase, fileName, startIngestion, reset } =
    useIngestion(handleIngestionComplete);

  const { suggestions, accept, dismiss } = useAgentSuggestions(
    nodes,
    edges,
    canvasReady,
  );

  const handleAcceptSuggestion = useCallback(
    (id: string) => {
      const suggestion = accept(id);
      if (!suggestion?.payload) return;

      const { node, link, propertyTarget, property } = suggestion.payload;
      if (node) {
        addNode(node);
        if (link) {
          setTimeout(() => {
            addLink(link);
            const extraLinks = reviewLinks.filter(
              (rl) => rl.id !== link.id,
            );
            for (const extra of extraLinks) {
              addLink(extra);
            }
          }, 300);
        }
      } else if (link) {
        addLink(link);
      } else if (propertyTarget && property) {
        addPropertyToNode(propertyTarget, property);
      }
    },
    [accept, addNode, addLink, addPropertyToNode],
  );

  const handleReset = useCallback(() => {
    reset();
    setCanvasReady(false);
    setSelectedNodeId(null);
  }, [reset, setSelectedNodeId]);

  const handleZoomIn = useCallback(() => {
    const controls = canvasRef.current?.controls;
    if (!controls) return;
    const camera = controls.object;
    camera.position.multiplyScalar(0.8);
    controls.update();
  }, []);

  const handleZoomOut = useCallback(() => {
    const controls = canvasRef.current?.controls;
    if (!controls) return;
    const camera = controls.object;
    camera.position.multiplyScalar(1.25);
    controls.update();
  }, []);

  const handleFitView = useCallback(() => {
    const controls = canvasRef.current?.controls;
    if (!controls) return;
    controls.object.position.set(0, 0, 20);
    controls.target.set(0, 0, 0);
    controls.update();
  }, []);

  const handleNodeClick = useCallback(
    (id: string) => {
      toggleNodeExpanded(id);
    },
    [toggleNodeExpanded],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className={styles.canvasContainer}>
      <DemoHeader />

      <StarfieldCanvas
        ref={canvasRef}
        nodes={nodes}
        edges={edges}
        phase={phase}
        fileName={fileName}
        selectedNodeId={selectedNodeId}
        onNodeClick={handleNodeClick}
      />

      <AnimatePresence>
        {phase === 'IDLE' && !canvasReady && (
          <IngestionDropZone onFileDropped={startIngestion} />
        )}
      </AnimatePresence>

      {canvasReady && (
        <>
          <CanvasToolbar
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitView={handleFitView}
            onReset={handleReset}
          />
          <AgentSidekick
            suggestions={suggestions}
            onAccept={handleAcceptSuggestion}
            onDismiss={dismiss}
          />
        </>
      )}

      <AnimatePresence>
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

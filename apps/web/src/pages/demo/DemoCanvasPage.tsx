import { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { ReactFlowInstance } from '@xyflow/react';
import DemoHeader from './components/DemoHeader';
import SemanticCanvas from './components/SemanticCanvas';
import IngestionDropZone from './components/IngestionDropZone';
import IngestionVortex from './components/IngestionVortex';
import AgentSidekick from './components/AgentSidekick';
import CanvasToolbar from './components/CanvasToolbar';
import { useDemoGraph } from './hooks/use-demo-graph';
import { useIngestion } from './hooks/use-ingestion';
import { useAgentSuggestions } from './hooks/use-agent-suggestions';
import { reviewLinks } from './mock/mock-suggestions';
import type { DemoObjectType, DemoLinkType } from './types';
import styles from './styles/canvas.module.css';

export function Component() {
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    crystallizeFromMock,
    addNode,
    addLink,
    addPropertyToNode,
    toggleNodeExpanded,
  } = useDemoGraph();

  const handleIngestionComplete = useCallback(
    (objectTypes: DemoObjectType[], linkTypes: DemoLinkType[]) => {
      crystallizeFromMock(objectTypes, linkTypes);
      setCanvasReady(true);
      // Fit view after nodes appear
      setTimeout(() => {
        flowRef.current?.fitView({ padding: 0.3, duration: 800 });
      }, 100);
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
        // If the suggestion also includes links (like Review node)
        if (link) {
          setTimeout(() => {
            addLink(link);
            // Add the second link for Review if it exists
            const extraLinks = reviewLinks.filter(
              (rl) => rl.id !== link.id,
            );
            for (const extra of extraLinks) {
              addLink(extra);
            }
            setTimeout(() => {
              flowRef.current?.fitView({ padding: 0.3, duration: 600 });
            }, 200);
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
  }, [reset]);

  const handleZoomIn = useCallback(() => {
    flowRef.current?.zoomIn({ duration: 300 });
  }, []);

  const handleZoomOut = useCallback(() => {
    flowRef.current?.zoomOut({ duration: 300 });
  }, []);

  const handleFitView = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.3, duration: 600 });
  }, []);

  const showDropZone = phase === 'IDLE';
  const showVortex = phase !== 'IDLE' && phase !== 'COMPLETE';
  const showCanvas = phase === 'COMPLETE' || nodes.length > 0;

  return (
    <div className={styles.canvasContainer}>
      <DemoHeader />

      {/* Canvas is always mounted but only visible when ready */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          paddingTop: 56,
          opacity: showCanvas ? 1 : 0,
          transition: 'opacity 0.6s ease',
          pointerEvents: showCanvas ? 'auto' : 'none',
        }}
      >
        <SemanticCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={toggleNodeExpanded}
          flowRef={flowRef}
        />
      </div>

      <AnimatePresence>
        {showDropZone && (
          <IngestionDropZone onFileDropped={startIngestion} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVortex && <IngestionVortex phase={phase} fileName={fileName} />}
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
    </div>
  );
}

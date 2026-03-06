import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Node, Edge, NodeTypes, EdgeTypes } from '@xyflow/react';
import ObjectTypeNode from './ObjectTypeNode';
import LinkTypeEdge from './LinkTypeEdge';

interface SemanticCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: Parameters<typeof ReactFlow>[0]['onNodesChange'];
  onEdgesChange: Parameters<typeof ReactFlow>[0]['onEdgesChange'];
  onConnect: Parameters<typeof ReactFlow>[0]['onConnect'];
  onNodeClick: (nodeId: string) => void;
  flowRef: React.MutableRefObject<ReactFlowInstance | null>;
}

export default function SemanticCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  flowRef,
}: SemanticCanvasProps) {
  const nodeTypes: NodeTypes = useMemo(
    () => ({ objectType: ObjectTypeNode }),
    [],
  );
  const edgeTypes: EdgeTypes = useMemo(
    () => ({ linkType: LinkTypeEdge }),
    [],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onInit={(instance) => {
        flowRef.current = instance;
      }}
      fitView
      fitViewOptions={{ padding: 0.3, duration: 800 }}
      minZoom={0.1}
      maxZoom={4}
      defaultEdgeOptions={{ type: 'linkType' }}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'transparent' }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="rgba(255, 255, 255, 0.08)"
      />
    </ReactFlow>
  );
}

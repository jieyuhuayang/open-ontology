import { useCallback, useState } from 'react';
import {
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  addEdge,
} from '@xyflow/react';
import type { DemoObjectType, DemoLinkType, DemoProperty } from '../types';

// Arrange nodes in an elliptical layout
function computeEllipsePositions(count: number, cx: number, cy: number) {
  const rx = Math.max(300, count * 60);
  const ry = Math.max(200, count * 40);
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

export function useDemoGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const crystallizeFromMock = useCallback(
    (objectTypes: DemoObjectType[], linkTypes: DemoLinkType[]) => {
      const positions = computeEllipsePositions(objectTypes.length, 0, 0);

      const newNodes: Node[] = objectTypes.map((ot, i) => ({
        id: ot.id,
        type: 'objectType',
        position: positions[i] ?? { x: 0, y: 0 },
        data: { ...ot, expanded: false },
      }));

      const newEdges: Edge[] = linkTypes.map((lt) => ({
        id: lt.id,
        source: lt.sourceId,
        target: lt.targetId,
        type: 'linkType',
        data: { label: lt.label, cardinality: lt.cardinality },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [setNodes, setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
        type: 'linkType',
        data: { label: 'relates to', cardinality: 'many-to-many' },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );

  const addNode = useCallback(
    (objectType: DemoObjectType) => {
      // Place new node near center with some randomness
      const node: Node = {
        id: objectType.id,
        type: 'objectType',
        position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 },
        data: { ...objectType, expanded: false },
      };
      setNodes((nds) => [...nds, node]);
    },
    [setNodes],
  );

  const addLink = useCallback(
    (linkType: DemoLinkType) => {
      const edge: Edge = {
        id: linkType.id,
        source: linkType.sourceId,
        target: linkType.targetId,
        type: 'linkType',
        data: { label: linkType.label, cardinality: linkType.cardinality },
      };
      setEdges((eds) => [...eds, edge]);
    },
    [setEdges],
  );

  const addPropertyToNode = useCallback(
    (nodeId: string, property: DemoProperty) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const properties = [...(n.data.properties as DemoProperty[]), property];
          return { ...n, data: { ...n.data, properties } };
        }),
      );
    },
    [setNodes],
  );

  const toggleNodeExpanded = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...n.data, expanded: !n.data.expanded } };
        }),
      );
      setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
    },
    [setNodes],
  );

  return {
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
    selectedNodeId,
  };
}

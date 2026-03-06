import { useCallback, useState } from 'react';
import type {
  DemoObjectType,
  DemoLinkType,
  DemoProperty,
  GraphNode,
  GraphEdge,
} from '../types';

function sphereLayout(count: number, radius = 8) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    return {
      x: r * Math.cos(theta) * radius,
      y: y * radius,
      z: r * Math.sin(theta) * radius,
    };
  });
}

export function useDemoGraph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const crystallizeFromMock = useCallback(
    (objectTypes: DemoObjectType[], linkTypes: DemoLinkType[]) => {
      const positions = sphereLayout(objectTypes.length);

      const newNodes: GraphNode[] = objectTypes.map((ot, i) => ({
        id: ot.id,
        position: positions[i] ?? { x: 0, y: 0, z: 0 },
        data: ot,
      }));

      const newEdges: GraphEdge[] = linkTypes.map((lt) => ({
        id: lt.id,
        source: lt.sourceId,
        target: lt.targetId,
        data: { label: lt.label, cardinality: lt.cardinality },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [],
  );

  const addNode = useCallback((objectType: DemoObjectType) => {
    setNodes((nds) => {
      const count = nds.length + 1;
      const positions = sphereLayout(count);
      const existing = nds.map((n, i) => ({
        ...n,
        position: positions[i] ?? n.position,
      }));
      const newNode: GraphNode = {
        id: objectType.id,
        position: positions[count - 1] ?? { x: 0, y: 0, z: 0 },
        data: objectType,
      };
      return [...existing, newNode];
    });
  }, []);

  const addLink = useCallback((linkType: DemoLinkType) => {
    const edge: GraphEdge = {
      id: linkType.id,
      source: linkType.sourceId,
      target: linkType.targetId,
      data: { label: linkType.label, cardinality: linkType.cardinality },
    };
    setEdges((eds) => [...eds, edge]);
  }, []);

  const addPropertyToNode = useCallback(
    (nodeId: string, property: DemoProperty) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const properties = [...n.data.properties, property];
          return { ...n, data: { ...n.data, properties } };
        }),
      );
    },
    [],
  );

  const toggleNodeExpanded = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  return {
    nodes,
    edges,
    crystallizeFromMock,
    addNode,
    addLink,
    addPropertyToNode,
    toggleNodeExpanded,
    selectedNodeId,
    setSelectedNodeId,
  };
}

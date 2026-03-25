import {
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkshopStore } from '../stores/workshop-store';
import type { WorkshopNode, WorkshopEdge } from '../types';

interface Workshop2DViewProps {
  nodes: WorkshopNode[];
  edges: WorkshopEdge[];
}

export interface Workshop2DViewHandle {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

const CONFIRMED_NODE_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.95)',
  color: '#1a1a2e',
  border: '2px solid rgba(255, 255, 255, 0.6)',
  borderRadius: 24,
  padding: '8px 16px',
  fontWeight: 600,
  fontSize: 13,
  minWidth: 80,
  textAlign: 'center',
};

const PENDING_HIGH_STYLE: React.CSSProperties = {
  ...CONFIRMED_NODE_STYLE,
  background: 'rgba(82, 196, 26, 0.15)',
  border: '2px solid rgba(82, 196, 26, 0.6)',
  color: '#d4edda',
};

const PENDING_MEDIUM_STYLE: React.CSSProperties = {
  ...CONFIRMED_NODE_STYLE,
  background: 'rgba(250, 173, 20, 0.15)',
  border: '2px solid rgba(250, 173, 20, 0.6)',
  color: '#fff3cd',
};

const PENDING_LOW_STYLE: React.CSSProperties = {
  ...CONFIRMED_NODE_STYLE,
  background: 'rgba(255, 77, 79, 0.15)',
  border: '2px solid rgba(255, 77, 79, 0.6)',
  color: '#f8d7da',
};

function getNodeStyle(node: WorkshopNode): React.CSSProperties {
  if (node.status === 'confirmed') return CONFIRMED_NODE_STYLE;
  switch (node.confidenceLevel) {
    case 'high':
      return PENDING_HIGH_STYLE;
    case 'medium':
      return PENDING_MEDIUM_STYLE;
    case 'low':
      return PENDING_LOW_STYLE;
    default:
      return PENDING_MEDIUM_STYLE;
  }
}

function getEdgeStyle(edge: WorkshopEdge): {
  style: React.CSSProperties;
  animated: boolean;
} {
  if (edge.status === 'confirmed') {
    return {
      style: { strokeWidth: 2, stroke: '#ffffff' },
      animated: false,
    };
  }
  const colorMap = {
    high: '#52c41a',
    medium: '#faad14',
    low: '#ff4d4f',
  };
  const color = colorMap[edge.confidenceLevel ?? 'medium'] ?? '#faad14';
  return {
    style: { strokeWidth: 1.5, stroke: color, strokeDasharray: '5 3' },
    animated: true,
  };
}

function getNodeLabel(node: WorkshopNode): string {
  const prefix = node.status === 'pending' ? '✦ ' : '';
  return `${prefix}${node.displayName}`;
}

const Workshop2DView = forwardRef<Workshop2DViewHandle, Workshop2DViewProps>(
  function Workshop2DView({ nodes, edges }, ref) {
    const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
    const setSelectedEntityRid = useWorkshopStore(
      (s) => s.setSelectedEntityRid,
    );
    const setHoveredEntityRid = useWorkshopStore(
      (s) => s.setHoveredEntityRid,
    );

    useImperativeHandle(ref, () => ({
      fitView: () => rfInstanceRef.current?.fitView({ padding: 0.2 }),
      zoomIn: () => rfInstanceRef.current?.zoomIn(),
      zoomOut: () => rfInstanceRef.current?.zoomOut(),
      resetView: () => {
        rfInstanceRef.current?.setViewport({ x: 0, y: 0, zoom: 1 });
      },
    }));

    const rfNodes: Node[] = useMemo(
      () =>
        nodes.map((node) => ({
          id: node.id,
          position: { x: node.position.x * 60, y: node.position.z * 60 },
          data: { label: getNodeLabel(node) },
          style: getNodeStyle(node),
        })),
      [nodes],
    );

    const rfEdges: Edge[] = useMemo(
      () =>
        edges.map((edge) => {
          const { style, animated } = getEdgeStyle(edge);
          const label = edge.cardinality
            ? `${edge.label} (${edge.cardinality})`
            : edge.label;
          return {
            id: edge.id,
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
            label,
            style,
            animated,
            markerEnd: { type: MarkerType.ArrowClosed },
            labelStyle: { fontSize: 11, fill: 'rgba(255,255,255,0.6)' },
            labelBgStyle: {
              fill: 'rgba(15, 15, 30, 0.8)',
              fillOpacity: 0.8,
            },
          };
        }),
      [edges],
    );

    const onNodeClick: NodeMouseHandler = useCallback(
      (_event, node) => {
        setSelectedEntityRid(node.id);
      },
      [setSelectedEntityRid],
    );

    const onNodeMouseEnter: NodeMouseHandler = useCallback(
      (_event, node) => {
        setHoveredEntityRid(node.id);
      },
      [setHoveredEntityRid],
    );

    const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
      setHoveredEntityRid(null);
    }, [setHoveredEntityRid]);

    return (
      <div
        style={{ width: '100%', height: '100%' }}
        data-testid="workshop-2d-view"
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onInit={(instance) => {
            rfInstanceRef.current = instance;
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          style={{ background: '#0a0a1a' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255,255,255,0.05)"
          />
        </ReactFlow>
      </div>
    );
  },
);

export default Workshop2DView;

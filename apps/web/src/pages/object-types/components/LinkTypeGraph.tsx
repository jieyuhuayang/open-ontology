import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LinkType } from '@/api/types';

interface LinkTypeGraphProps {
  objectTypeRid: string;
  objectTypeDisplayName: string;
  linkTypes: LinkType[];
}

const NODE_STYLE_CENTER = {
  background: '#1677ff',
  color: '#fff',
  border: '2px solid #1677ff',
  borderRadius: 8,
  padding: '8px 16px',
  fontWeight: 600,
  fontSize: 14,
};

const NODE_STYLE_RELATED = {
  background: '#fafafa',
  color: '#333',
  border: '1px solid #d9d9d9',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
};

export default function LinkTypeGraph({
  objectTypeRid,
  objectTypeDisplayName,
  linkTypes,
}: LinkTypeGraphProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];

    // Center node = current OT
    nodeMap.set(objectTypeRid, {
      id: objectTypeRid,
      position: { x: 300, y: 200 },
      data: { label: objectTypeDisplayName },
      style: NODE_STYLE_CENTER,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    const relatedOTs = new Set<string>();

    linkTypes.forEach((lt, index) => {
      const otherSide =
        lt.sideA.objectTypeRid === objectTypeRid ? lt.sideB : lt.sideA;
      const isSelfLink = lt.sideA.objectTypeRid === lt.sideB.objectTypeRid;

      if (!isSelfLink) {
        const otherRid = otherSide.objectTypeRid;
        if (!nodeMap.has(otherRid)) {
          const angle = (2 * Math.PI * relatedOTs.size) / Math.max(linkTypes.length, 1);
          const radius = 200;
          nodeMap.set(otherRid, {
            id: otherRid,
            position: {
              x: 300 + radius * Math.cos(angle),
              y: 200 + radius * Math.sin(angle),
            },
            data: {
              label: otherSide.objectTypeDisplayName ?? otherRid,
            },
            style: NODE_STYLE_RELATED,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
          relatedOTs.add(otherRid);
        }
      }

      const cardLabel = t(`linkType.cardinality.${lt.cardinality}`);
      const methodLabel =
        lt.joinMethod === 'join-table'
          ? t('linkType.joinMethod.joinTable')
          : t('linkType.joinMethod.foreignKey');
      const displayName =
        lt.sideA.objectTypeRid === objectTypeRid ? lt.sideA.displayName : lt.sideB.displayName;

      edgeList.push({
        id: lt.rid,
        source: objectTypeRid,
        target: isSelfLink ? objectTypeRid : otherSide.objectTypeRid,
        label: displayName,
        data: { linkTypeRid: lt.rid, cardinality: cardLabel, method: methodLabel, ltId: lt.id },
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2, stroke: '#91caff' },
        labelStyle: { fontSize: 11, fill: '#666' },
        ...(isSelfLink
          ? {
              type: 'smoothstep',
              sourceHandle: `self-source-${index}`,
              targetHandle: `self-target-${index}`,
            }
          : {}),
      });
    });

    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [objectTypeRid, objectTypeDisplayName, linkTypes, t]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.id !== objectTypeRid) {
        navigate(`/object-types/${node.id}`);
      }
    },
    [navigate, objectTypeRid],
  );

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      const rid = edge.data?.linkTypeRid;
      if (rid) {
        navigate(`/link-types/${rid}`);
      }
    },
    [navigate],
  );

  return (
    <div style={{ height: 350, border: '1px solid #f0f0f0', borderRadius: 8 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

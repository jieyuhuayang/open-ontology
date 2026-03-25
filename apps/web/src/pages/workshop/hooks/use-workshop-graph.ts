import { useMemo } from 'react';
import { useObjectTypes } from '@/api/object-types';
import { useLinkTypes } from '@/api/link-types';
import { useBlueprintDetail } from '@/api/blueprints';
import type { ObjectType, LinkType, BlueprintItem } from '@/api/types';
import type { WorkshopNode, WorkshopEdge } from '../types';

// Default colors for nodes
const NODE_COLORS = [
  '#4f8eff',
  '#36cfc9',
  '#ff7a45',
  '#9254de',
  '#f759ab',
  '#ffc53d',
  '#73d13d',
  '#40a9ff',
];

function getColor(index: number): string {
  return NODE_COLORS[index % NODE_COLORS.length] ?? '#4f8eff';
}

/** Distribute nodes on a sphere surface */
function sphereLayout(
  count: number,
  radius = 8,
): Array<{ x: number; y: number; z: number }> {
  if (count === 0) return [];
  if (count === 1) return [{ x: 0, y: 0, z: 0 }];

  const positions: Array<{ x: number; y: number; z: number }> = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / count);
    const phi = (2 * Math.PI * i) / goldenRatio;

    positions.push({
      x: radius * Math.sin(theta) * Math.cos(phi),
      y: radius * Math.sin(theta) * Math.sin(phi),
      z: radius * Math.cos(theta),
    });
  }

  return positions;
}

export function objectTypeToNode(
  ot: ObjectType,
  index: number,
): Omit<WorkshopNode, 'position'> {
  return {
    id: ot.rid,
    type: 'object_type',
    displayName: ot.displayName,
    apiName: ot.apiName,
    description: ot.description ?? undefined,
    icon: ot.icon?.name,
    color: getColor(index),
    status: 'confirmed',
  };
}

export function blueprintItemToNode(
  item: BlueprintItem,
  index: number,
): Omit<WorkshopNode, 'position'> | null {
  if (item.itemType !== 'object_type') return null;
  const suggestion = item.suggestion as Record<string, unknown>;
  return {
    id: item.rid,
    type: 'object_type',
    displayName: (suggestion.displayName as string) ?? 'Unknown',
    apiName: suggestion.apiName as string | undefined,
    description: suggestion.description as string | undefined,
    color: getColor(index),
    status: 'pending',
    confidence: item.confidence,
    confidenceLevel: item.confidenceLevel as 'high' | 'medium' | 'low',
    reasoning: item.reasoning ?? undefined,
    source: item.source as WorkshopNode['source'],
    blueprintItemRid: item.rid,
    properties: Array.isArray(suggestion.properties)
      ? (suggestion.properties as Array<Record<string, string>>).map((p) => ({
          displayName: p.displayName ?? '',
          apiName: p.apiName ?? '',
          baseType: p.baseType ?? 'string',
        }))
      : undefined,
  };
}

export function blueprintItemToEdge(
  item: BlueprintItem,
): WorkshopEdge | null {
  if (item.itemType !== 'link_type') return null;
  const suggestion = item.suggestion as Record<string, unknown>;
  return {
    id: item.rid,
    sourceNodeId: (suggestion.sideAObjectRid as string) ?? '',
    targetNodeId: (suggestion.sideBObjectRid as string) ?? '',
    label:
      (suggestion.displayName as string) ?? (suggestion.name as string) ?? '',
    cardinality: suggestion.cardinality as string | undefined,
    status: 'pending',
    confidence: item.confidence,
    confidenceLevel: item.confidenceLevel as 'high' | 'medium' | 'low',
    blueprintItemRid: item.rid,
  };
}

interface UseWorkshopGraphReturn {
  nodes: WorkshopNode[];
  edges: WorkshopEdge[];
  isLoading: boolean;
}

export function linkTypeToEdge(lt: LinkType): WorkshopEdge {
  return {
    id: lt.rid,
    sourceNodeId: lt.sideA.objectTypeRid,
    targetNodeId: lt.sideB.objectTypeRid,
    label: lt.sideA.displayName,
    cardinality: lt.cardinality,
    status: 'confirmed',
  };
}

export function useWorkshopGraph(
  ontologyRid: string,
  blueprintRid: string | null,
): UseWorkshopGraphReturn {
  const { data: otData, isLoading: otLoading } = useObjectTypes(1, 100);
  const { data: ltData, isLoading: ltLoading } = useLinkTypes(1, 100);
  const { data: bpData, isLoading: bpLoading } =
    useBlueprintDetail(blueprintRid);

  const result = useMemo(() => {
    const rawNodes: Array<Omit<WorkshopNode, 'position'>> = [];
    const edges: WorkshopEdge[] = [];

    // Existing ObjectTypes
    const objectTypes = (otData?.items ?? []) as ObjectType[];
    objectTypes.forEach((ot, i) => {
      rawNodes.push(objectTypeToNode(ot, i));
    });

    // Existing LinkTypes → confirmed edges
    const linkTypes = (ltData?.items ?? []) as LinkType[];
    linkTypes.forEach((lt) => {
      edges.push(linkTypeToEdge(lt));
    });

    // Blueprint items
    if (bpData) {
      const items = bpData.items ?? [];
      items.forEach((item: BlueprintItem, i: number) => {
        const node = blueprintItemToNode(item, objectTypes.length + i);
        if (node) rawNodes.push(node);

        const edge = blueprintItemToEdge(item);
        if (edge) edges.push(edge);
      });
    }

    // Calculate positions
    const positions = sphereLayout(rawNodes.length);
    const nodes: WorkshopNode[] = rawNodes.map((n, i) => ({
      ...n,
      position: positions[i] ?? { x: 0, y: 0, z: 0 },
    }));

    return { nodes, edges };
  }, [otData, ltData, bpData]);

  return {
    nodes: result.nodes,
    edges: result.edges,
    isLoading: otLoading || ltLoading || bpLoading,
  };
}

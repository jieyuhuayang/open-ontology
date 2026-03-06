export interface DemoProperty {
  name: string;
  type: string;
  description: string;
}

export interface DemoObjectType {
  id: string;
  displayName: string;
  icon: string;
  color: string;
  properties: DemoProperty[];
}

export interface DemoLinkType {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  cardinality: string;
}

export interface GraphNode {
  id: string;
  position: { x: number; y: number; z: number };
  data: DemoObjectType;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data: { label: string; cardinality: string };
}

export type IngestionPhase =
  | 'IDLE'
  | 'ABSORBING'
  | 'PROCESSING'
  | 'CRYSTALLIZING'
  | 'COMPLETE';

export interface DragLinkState {
  sourceNodeId: string;
  sourcePosition: { x: number; y: number; z: number };
  currentPointerPosition: { x: number; y: number; z: number };
  hoveredTargetId: string | null;
}

export interface PendingLink {
  sourceId: string;
  targetId: string;
}

export interface Suggestion {
  id: string;
  text: string;
  type: 'add-link' | 'add-property' | 'add-node';
  payload?: {
    node?: DemoObjectType;
    link?: DemoLinkType;
    propertyTarget?: string;
    property?: DemoProperty;
  };
  createdAt: number;
}

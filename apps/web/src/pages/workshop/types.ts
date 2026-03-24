/** Workshop page state machine */
export type WorkshopPageState =
  | 'empty'
  | 'existing'
  | 'analyzing'
  | 'blueprint_pending'
  | 'disconnected';

/** Unified canvas node — adapts ObjectType + BlueprintItem */
export interface WorkshopNode {
  id: string;
  type: 'object_type' | 'link_type';
  displayName: string;
  apiName?: string;
  description?: string;
  icon?: string;
  color: string;
  properties?: WorkshopProperty[];
  position: { x: number; y: number; z: number };
  status: 'confirmed' | 'pending';
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  reasoning?: string;
  source?:
    | 'field_analysis'
    | 'pattern_matching'
    | 'semantic_inference'
    | 'best_practices';
  blueprintItemRid?: string;
}

export interface WorkshopProperty {
  displayName: string;
  apiName: string;
  baseType: string;
}

/** Unified canvas edge — adapts LinkType + BlueprintItem link_type */
export interface WorkshopEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string;
  cardinality?: string;
  status: 'confirmed' | 'pending';
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  blueprintItemRid?: string;
}

/** Drag link state (reused from demo pattern) */
export interface DragLinkState {
  sourceNodeId: string;
  sourcePosition: { x: number; y: number; z: number };
  currentPointerPosition: { x: number; y: number; z: number };
  hoveredTargetId: string | null;
}

/** SSE blueprint-item event data */
export interface SSEBlueprintItemData {
  rid: string;
  itemType: string;
  suggestion: Record<string, unknown>;
  confidence: number;
  confidenceLevel: string;
}

/** SSE event union type */
export type SSEEvent =
  | { type: 'text-delta'; data: { text: string } }
  | {
      type: 'plan-step';
      data: { step: string; index: number; total: number };
    }
  | { type: 'blueprint-item'; data: SSEBlueprintItemData }
  | {
      type: 'blueprint-complete';
      data: {
        blueprintRid: string;
        name: string;
        status: string;
        itemCount: number;
      };
    }
  | {
      type: 'material-uploaded';
      data: { rid: string; fileName: string; fileType: string };
    }
  | { type: 'done'; data: { sessionRid: string; summary: string } }
  | { type: 'error'; data: { code: string; message: string } };

/** Plan step entry */
export interface PlanStep {
  step: string;
  index: number;
  total: number;
}

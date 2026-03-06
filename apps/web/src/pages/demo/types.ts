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

export type IngestionPhase =
  | 'IDLE'
  | 'ABSORBING'
  | 'PROCESSING'
  | 'CRYSTALLIZING'
  | 'COMPLETE';

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

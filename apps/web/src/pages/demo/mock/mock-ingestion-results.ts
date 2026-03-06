import { mockObjectTypes, mockLinkTypes } from './mock-ontology';

interface IngestionResult {
  objectTypes: typeof mockObjectTypes;
  linkTypes: typeof mockLinkTypes;
}

const filePatterns: Record<string, string[]> = {
  ecommerce: ['ecommerce', 'shop', 'store', 'commerce', 'retail'],
  order: ['order', 'transaction', 'purchase', 'sales'],
  customer: ['customer', 'user', 'client', 'account'],
  product: ['product', 'item', 'catalog', 'inventory'],
};

export function getIngestionResult(_fileName: string): IngestionResult {
  // Always return the full e-commerce ontology regardless of file name
  // In a real system, this would parse the file and extract schema
  return {
    objectTypes: mockObjectTypes,
    linkTypes: mockLinkTypes,
  };
}

export { filePatterns };

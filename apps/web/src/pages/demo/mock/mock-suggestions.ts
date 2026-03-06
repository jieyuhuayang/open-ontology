import type { Suggestion, DemoObjectType, DemoLinkType } from '../types';

let suggestionCounter = 0;

interface SuggestionTemplate {
  text: string;
  type: Suggestion['type'];
  condition: (nodeIds: string[], edgeKeys: string[]) => boolean;
  payload: Suggestion['payload'];
}

const reviewNode: DemoObjectType = {
  id: 'review',
  displayName: 'Review',
  icon: 'StarOutlined',
  color: '#fadb14',
  properties: [
    { name: 'reviewId', type: 'string', description: 'Unique review identifier' },
    { name: 'rating', type: 'integer', description: 'Rating from 1 to 5' },
    { name: 'comment', type: 'string', description: 'Review text' },
    { name: 'createdAt', type: 'timestamp', description: 'Review date' },
  ],
};

const reviewLinks: DemoLinkType[] = [
  {
    id: 'customer-review',
    sourceId: 'customer',
    targetId: 'review',
    label: 'writes',
    cardinality: 'one-to-many',
  },
  {
    id: 'review-product',
    sourceId: 'review',
    targetId: 'product',
    label: 'about',
    cardinality: 'many-to-one',
  },
];

const suggestionPool: SuggestionTemplate[] = [
  {
    text: 'Customer and Product have no direct link. Consider adding a "favorites" or "wishlist" relationship.',
    type: 'add-link',
    condition: (nodeIds, edgeKeys) =>
      nodeIds.includes('customer') &&
      nodeIds.includes('product') &&
      !edgeKeys.includes('customer->product'),
    payload: {
      link: {
        id: 'customer-wishlist',
        sourceId: 'customer',
        targetId: 'product',
        label: 'wishlists',
        cardinality: 'many-to-many',
      },
    },
  },
  {
    text: 'A "Review" entity could capture customer feedback on products.',
    type: 'add-node',
    condition: (nodeIds) => !nodeIds.includes('review'),
    payload: {
      node: reviewNode,
      link: reviewLinks[0],
    },
  },
  {
    text: 'Order is missing a "shippingMethod" property for logistics tracking.',
    type: 'add-property',
    condition: (nodeIds) => nodeIds.includes('order'),
    payload: {
      propertyTarget: 'order',
      property: {
        name: 'shippingMethod',
        type: 'string',
        description: 'Shipping carrier and method',
      },
    },
  },
  {
    text: 'Product could benefit from a "weight" property for shipping cost calculation.',
    type: 'add-property',
    condition: (nodeIds) => nodeIds.includes('product'),
    payload: {
      propertyTarget: 'product',
      property: {
        name: 'weight',
        type: 'decimal',
        description: 'Product weight in kilograms',
      },
    },
  },
  {
    text: 'Shipping Address lacks a "label" property (e.g., "Home", "Office").',
    type: 'add-property',
    condition: (nodeIds) => nodeIds.includes('shipping-address'),
    payload: {
      propertyTarget: 'shipping-address',
      property: {
        name: 'label',
        type: 'string',
        description: 'Address label (Home, Office, etc.)',
      },
    },
  },
];

export function getNextSuggestion(
  nodeIds: string[],
  edgeKeys: string[],
  usedIds: Set<string>,
): Suggestion | null {
  for (const template of suggestionPool) {
    const id = `suggestion-${template.text.slice(0, 20)}`;
    if (usedIds.has(id)) continue;
    if (!template.condition(nodeIds, edgeKeys)) continue;

    suggestionCounter++;
    return {
      id: `${id}-${suggestionCounter}`,
      text: template.text,
      type: template.type,
      payload: template.payload,
      createdAt: Date.now(),
    };
  }
  return null;
}

export { reviewLinks };

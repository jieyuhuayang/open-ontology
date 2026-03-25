import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEntityHighlights } from '../use-entity-highlights';
import { useWorkshopStore } from '../../stores/workshop-store';
import type { WorkshopNode } from '../../types';

const makeNode = (id: string, name: string): WorkshopNode => ({
  id,
  type: 'object_type',
  displayName: name,
  color: '#fff',
  position: { x: 0, y: 0, z: 0 },
  status: 'pending',
});

describe('useEntityHighlights', () => {
  beforeEach(() => {
    useWorkshopStore.getState().reset();
  });

  describe('findEntityAnchors', () => {
    it('finds entity names in text', () => {
      const nodes = [makeNode('n1', 'Order'), makeNode('n2', 'Product')];
      const { result } = renderHook(() => useEntityHighlights(nodes));

      const anchors = result.current.findEntityAnchors(
        'The Order entity links to Product',
      );
      expect(anchors).toHaveLength(2);
      expect(anchors[0]?.displayName).toBe('Order');
      expect(anchors[0]?.startIndex).toBe(4);
      expect(anchors[1]?.displayName).toBe('Product');
    });

    it('is case insensitive', () => {
      const nodes = [makeNode('n1', 'Order')];
      const { result } = renderHook(() => useEntityHighlights(nodes));

      const anchors = result.current.findEntityAnchors('the order was placed');
      expect(anchors).toHaveLength(1);
      expect(anchors[0]?.rid).toBe('n1');
    });

    it('finds multiple occurrences', () => {
      const nodes = [makeNode('n1', 'Order')];
      const { result } = renderHook(() => useEntityHighlights(nodes));

      const anchors = result.current.findEntityAnchors(
        'Order placed, then Order shipped',
      );
      expect(anchors).toHaveLength(2);
    });

    it('returns empty for no matches', () => {
      const nodes = [makeNode('n1', 'Order')];
      const { result } = renderHook(() => useEntityHighlights(nodes));

      const anchors = result.current.findEntityAnchors('No entities here');
      expect(anchors).toHaveLength(0);
    });

    it('handles overlapping names — longer match wins', () => {
      const nodes = [
        makeNode('n1', 'Order'),
        makeNode('n2', 'Order Status'),
      ];
      const { result } = renderHook(() => useEntityHighlights(nodes));

      const anchors = result.current.findEntityAnchors(
        'Check the Order Status field',
      );
      // "Order Status" is longer, should match first
      expect(anchors).toHaveLength(1);
      expect(anchors[0]?.displayName).toBe('Order Status');
    });
  });

  describe('getHighlightedMessageIndices', () => {
    it('returns indices of messages mentioning entity', () => {
      const nodes = [makeNode('n1', 'Order')];
      const { result } = renderHook(() => useEntityHighlights(nodes));

      const messages = [
        { content: 'Analyzing Order data' },
        { content: 'Product found' },
        { content: 'Order has 5 properties' },
      ];
      const indices = result.current.getHighlightedMessageIndices(
        messages,
        'n1',
      );
      expect(indices).toEqual([0, 2]);
    });

    it('returns empty for unknown entity', () => {
      const nodes = [makeNode('n1', 'Order')];
      const { result } = renderHook(() => useEntityHighlights(nodes));

      const messages = [{ content: 'Hello world' }];
      const indices = result.current.getHighlightedMessageIndices(
        messages,
        'unknown',
      );
      expect(indices).toEqual([]);
    });
  });
});

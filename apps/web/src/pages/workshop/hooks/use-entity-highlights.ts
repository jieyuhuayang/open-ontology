import { useCallback, useMemo } from 'react';
import { useWorkshopStore } from '../stores/workshop-store';
import type { WorkshopNode } from '../types';

interface EntityAnchor {
  rid: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

export function useEntityHighlights(nodes: WorkshopNode[]) {
  const setHighlightedEntityRids = useWorkshopStore(
    (s) => s.setHighlightedEntityRids,
  );
  const clearHighlights = useWorkshopStore((s) => s.clearHighlights);

  const highlightFromChat = useCallback(
    (rid: string) => setHighlightedEntityRids([rid]),
    [setHighlightedEntityRids],
  );

  const clearChatHighlight = useCallback(
    () => clearHighlights(),
    [clearHighlights],
  );

  /** Find all entity name occurrences in a text string */
  const findEntityAnchors = useCallback(
    (text: string): EntityAnchor[] => {
      const anchors: EntityAnchor[] = [];
      const textLower = text.toLowerCase();

      // Sort nodes by displayName length descending to match longest first
      const sorted = [...nodes].sort(
        (a, b) => b.displayName.length - a.displayName.length,
      );

      const usedRanges: Array<[number, number]> = [];

      for (const node of sorted) {
        const nameLower = node.displayName.toLowerCase();
        if (nameLower.length < 2) continue; // skip very short names

        let searchFrom = 0;
        while (searchFrom < textLower.length) {
          const idx = textLower.indexOf(nameLower, searchFrom);
          if (idx === -1) break;

          const endIdx = idx + node.displayName.length;

          // Check no overlap with existing anchors
          const overlaps = usedRanges.some(
            ([s, e]) => idx < e && endIdx > s,
          );

          if (!overlaps) {
            anchors.push({
              rid: node.id,
              displayName: node.displayName,
              startIndex: idx,
              endIndex: endIdx,
            });
            usedRanges.push([idx, endIdx]);
          }

          searchFrom = endIdx;
        }
      }

      return anchors.sort((a, b) => a.startIndex - b.startIndex);
    },
    [nodes],
  );

  /** Get indices of messages that mention a given entity */
  const getHighlightedMessageIndices = useCallback(
    (messages: Array<{ content: string }>, entityRid: string): number[] => {
      const node = nodes.find((n) => n.id === entityRid);
      if (!node) return [];

      const nameLower = node.displayName.toLowerCase();
      const indices: number[] = [];

      messages.forEach((msg, idx) => {
        if (msg.content.toLowerCase().includes(nameLower)) {
          indices.push(idx);
        }
      });

      return indices;
    },
    [nodes],
  );

  return {
    highlightFromChat,
    clearChatHighlight,
    findEntityAnchors,
    getHighlightedMessageIndices,
  };
}

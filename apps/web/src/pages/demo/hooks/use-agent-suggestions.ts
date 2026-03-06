import { useState, useEffect, useCallback, useRef } from 'react';
import type { Suggestion } from '../types';
import { getNextSuggestion } from '../mock/mock-suggestions';
import type { Node, Edge } from '@xyflow/react';

const MAX_VISIBLE = 3;
const SUGGESTION_INTERVAL_MIN = 4000;
const SUGGESTION_INTERVAL_MAX = 6000;
const SUGGESTION_TTL = 30000;

export function useAgentSuggestions(
  nodes: Node[],
  edges: Edge[],
  isActive: boolean,
) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const usedIdsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setTimeout>>();

  // Generate suggestions periodically
  useEffect(() => {
    if (!isActive) return;

    function scheduleNext() {
      const delay =
        SUGGESTION_INTERVAL_MIN +
        Math.random() * (SUGGESTION_INTERVAL_MAX - SUGGESTION_INTERVAL_MIN);

      intervalRef.current = setTimeout(() => {
        setSuggestions((prev) => {
          if (prev.length >= MAX_VISIBLE) {
            scheduleNext();
            return prev;
          }

          const nodeIds = nodes.map((n) => n.id);
          const edgeKeys = edges.map((e) => `${e.source}->${e.target}`);
          const suggestion = getNextSuggestion(nodeIds, edgeKeys, usedIdsRef.current);

          if (suggestion) {
            usedIdsRef.current.add(suggestion.id.replace(/-\d+$/, ''));
            scheduleNext();
            return [...prev, suggestion];
          }

          scheduleNext();
          return prev;
        });
      }, delay);
    }

    scheduleNext();

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [isActive, nodes, edges]);

  // Auto-expire suggestions
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setSuggestions((prev) =>
        prev.filter((s) => now - s.createdAt < SUGGESTION_TTL),
      );
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const dismiss = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const accept = useCallback((id: string) => {
    let accepted: Suggestion | undefined;
    setSuggestions((prev) => {
      accepted = prev.find((s) => s.id === id);
      return prev.filter((s) => s.id !== id);
    });
    return accepted;
  }, []);

  return { suggestions, dismiss, accept };
}

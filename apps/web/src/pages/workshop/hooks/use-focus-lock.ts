import { useCallback, useEffect, useMemo } from 'react';
import { useWorkshopStore } from '../stores/workshop-store';
import type { WorkshopNode } from '../types';

export function useFocusLock(nodes: WorkshopNode[]) {
  const focusedEntityRid = useWorkshopStore((s) => s.focusedEntityRid);
  const setFocusedEntityRid = useWorkshopStore(
    (s) => s.setFocusedEntityRid,
  );
  const clearFocusLock = useWorkshopStore((s) => s.clearFocusLock);

  const focusedEntity = useMemo(
    () => nodes.find((n) => n.id === focusedEntityRid) ?? null,
    [nodes, focusedEntityRid],
  );

  // Auto-clear if focused entity was removed from nodes
  useEffect(() => {
    if (focusedEntityRid && !nodes.some((n) => n.id === focusedEntityRid)) {
      clearFocusLock();
    }
  }, [focusedEntityRid, nodes, clearFocusLock]);

  const lockEntity = useCallback(
    (rid: string) => setFocusedEntityRid(rid),
    [setFocusedEntityRid],
  );

  const unlockEntity = useCallback(() => clearFocusLock(), [clearFocusLock]);

  const prefixMessage = useCallback(
    (content: string): string => {
      if (!focusedEntity) return content;
      return `[关于 ${focusedEntity.displayName}] ${content}`;
    },
    [focusedEntity],
  );

  return { focusedEntity, lockEntity, unlockEntity, prefixMessage };
}

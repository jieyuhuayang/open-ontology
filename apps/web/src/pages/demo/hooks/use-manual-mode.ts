import { useState, useCallback } from 'react';
import type { DragLinkState, PendingLink } from '../types';

export function useManualMode() {
  const [isCreationPanelOpen, setIsCreationPanelOpen] = useState(false);
  const [isAddFormVisible, setIsAddFormVisible] = useState(false);
  const [dragLink, setDragLink] = useState<DragLinkState | null>(null);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);

  const orbitEnabled = dragLink === null;

  const toggleCreationPanel = useCallback(() => {
    setIsCreationPanelOpen((prev) => {
      if (prev) setIsAddFormVisible(false);
      return !prev;
    });
  }, []);

  const openAddForm = useCallback(() => {
    setIsAddFormVisible(true);
  }, []);

  const closeAddForm = useCallback(() => {
    setIsAddFormVisible(false);
  }, []);

  const startDragLink = useCallback(
    (
      nodeId: string,
      position: { x: number; y: number; z: number },
    ) => {
      setDragLink({
        sourceNodeId: nodeId,
        sourcePosition: position,
        currentPointerPosition: { ...position },
        hoveredTargetId: null,
      });
    },
    [],
  );

  const updateDragPointer = useCallback(
    (
      position: { x: number; y: number; z: number },
      hoveredTargetId?: string | null,
    ) => {
      setDragLink((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentPointerPosition: position,
          hoveredTargetId:
            hoveredTargetId !== undefined
              ? hoveredTargetId
              : prev.hoveredTargetId,
        };
      });
    },
    [],
  );

  const endDragLink = useCallback((targetNodeId?: string) => {
    setDragLink((prev) => {
      if (!prev) return null;
      if (targetNodeId && targetNodeId !== prev.sourceNodeId) {
        setPendingLink({
          sourceId: prev.sourceNodeId,
          targetId: targetNodeId,
        });
      }
      return null;
    });
  }, []);

  const confirmPendingLink = useCallback(() => {
    const link = pendingLink;
    setPendingLink(null);
    return link;
  }, [pendingLink]);

  const cancelPendingLink = useCallback(() => {
    setPendingLink(null);
  }, []);

  return {
    isCreationPanelOpen,
    isAddFormVisible,
    dragLink,
    pendingLink,
    orbitEnabled,
    toggleCreationPanel,
    openAddForm,
    closeAddForm,
    startDragLink,
    updateDragPointer,
    endDragLink,
    confirmPendingLink,
    cancelPendingLink,
  };
}

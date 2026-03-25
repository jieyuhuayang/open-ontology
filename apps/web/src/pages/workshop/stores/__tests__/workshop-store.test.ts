import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkshopStore } from '../workshop-store';

describe('workshop-store', () => {
  beforeEach(() => {
    useWorkshopStore.getState().reset();
  });

  describe('pageState', () => {
    it('starts with empty', () => {
      expect(useWorkshopStore.getState().pageState).toBe('empty');
    });

    it('transitions through states', () => {
      const { setPageState } = useWorkshopStore.getState();
      setPageState('existing');
      expect(useWorkshopStore.getState().pageState).toBe('existing');

      setPageState('analyzing');
      expect(useWorkshopStore.getState().pageState).toBe('analyzing');

      setPageState('blueprint_pending');
      expect(useWorkshopStore.getState().pageState).toBe('blueprint_pending');
    });
  });

  describe('connectionStatus', () => {
    it('starts idle', () => {
      expect(useWorkshopStore.getState().connectionStatus).toBe('idle');
    });

    it('transitions idle → connected → reconnecting → disconnected', () => {
      const { setConnectionStatus } = useWorkshopStore.getState();

      setConnectionStatus('connected');
      expect(useWorkshopStore.getState().connectionStatus).toBe('connected');

      setConnectionStatus('reconnecting');
      expect(useWorkshopStore.getState().connectionStatus).toBe(
        'reconnecting',
      );

      setConnectionStatus('disconnected');
      expect(useWorkshopStore.getState().connectionStatus).toBe(
        'disconnected',
      );
    });
  });

  describe('panel visibility', () => {
    it('chat panel starts expanded', () => {
      expect(useWorkshopStore.getState().isChatPanelExpanded).toBe(true);
    });

    it('toggles chat panel', () => {
      useWorkshopStore.getState().toggleChatPanel();
      expect(useWorkshopStore.getState().isChatPanelExpanded).toBe(false);

      useWorkshopStore.getState().toggleChatPanel();
      expect(useWorkshopStore.getState().isChatPanelExpanded).toBe(true);
    });

    it('sidekick starts open', () => {
      expect(useWorkshopStore.getState().isSidekickOpen).toBe(true);
    });

    it('toggles sidekick', () => {
      useWorkshopStore.getState().toggleSidekick();
      expect(useWorkshopStore.getState().isSidekickOpen).toBe(false);
    });
  });

  describe('entity interaction', () => {
    it('sets selected entity', () => {
      useWorkshopStore.getState().setSelectedEntityRid('ri.test.123');
      expect(useWorkshopStore.getState().selectedEntityRid).toBe(
        'ri.test.123',
      );
    });

    it('clears selected entity', () => {
      useWorkshopStore.getState().setSelectedEntityRid('ri.test.123');
      useWorkshopStore.getState().setSelectedEntityRid(null);
      expect(useWorkshopStore.getState().selectedEntityRid).toBeNull();
    });

    it('sets hovered entity', () => {
      useWorkshopStore.getState().setHoveredEntityRid('ri.test.456');
      expect(useWorkshopStore.getState().hoveredEntityRid).toBe(
        'ri.test.456',
      );
    });
  });

  describe('plan steps', () => {
    it('adds plan steps', () => {
      const { addPlanStep } = useWorkshopStore.getState();
      addPlanStep({ step: 'Analyzing CSV', index: 0, total: 3 });
      addPlanStep({ step: 'Extracting entities', index: 1, total: 3 });

      const steps = useWorkshopStore.getState().planSteps;
      expect(steps).toHaveLength(2);
      expect(steps[0]?.step).toBe('Analyzing CSV');
      expect(steps[1]?.step).toBe('Extracting entities');
    });

    it('clears plan steps', () => {
      useWorkshopStore.getState().addPlanStep({ step: 'Test', index: 0, total: 1 });
      useWorkshopStore.getState().clearPlanSteps();
      expect(useWorkshopStore.getState().planSteps).toHaveLength(0);
    });
  });

  describe('crystallization queue', () => {
    const mockItem = {
      rid: 'ri.ontology.blueprint-item.001',
      itemType: 'object_type',
      suggestion: { displayName: 'Order' },
      confidence: 0.92,
      confidenceLevel: 'high',
    };

    it('adds pending crystallization', () => {
      useWorkshopStore.getState().addPendingCrystallization(mockItem);
      expect(useWorkshopStore.getState().pendingCrystallizations).toHaveLength(
        1,
      );
      expect(
        useWorkshopStore.getState().pendingCrystallizations[0]?.rid,
      ).toBe(mockItem.rid);
    });

    it('consumes crystallization by rid', () => {
      useWorkshopStore.getState().addPendingCrystallization(mockItem);
      useWorkshopStore
        .getState()
        .consumeCrystallization('ri.ontology.blueprint-item.001');
      expect(useWorkshopStore.getState().pendingCrystallizations).toHaveLength(
        0,
      );
    });

    it('does not remove other items when consuming', () => {
      const item2 = { ...mockItem, rid: 'ri.ontology.blueprint-item.002' };
      useWorkshopStore.getState().addPendingCrystallization(mockItem);
      useWorkshopStore.getState().addPendingCrystallization(item2);
      useWorkshopStore
        .getState()
        .consumeCrystallization('ri.ontology.blueprint-item.001');

      const remaining = useWorkshopStore.getState().pendingCrystallizations;
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.rid).toBe('ri.ontology.blueprint-item.002');
    });
  });

  describe('viewMode (F016)', () => {
    it('starts with 3d', () => {
      expect(useWorkshopStore.getState().viewMode).toBe('3d');
    });

    it('switches to 2d', () => {
      useWorkshopStore.getState().setViewMode('2d');
      expect(useWorkshopStore.getState().viewMode).toBe('2d');
    });

    it('switches back to 3d', () => {
      useWorkshopStore.getState().setViewMode('2d');
      useWorkshopStore.getState().setViewMode('3d');
      expect(useWorkshopStore.getState().viewMode).toBe('3d');
    });
  });

  describe('focusLock (F016)', () => {
    it('starts with null', () => {
      expect(useWorkshopStore.getState().focusedEntityRid).toBeNull();
    });

    it('sets focused entity', () => {
      useWorkshopStore.getState().setFocusedEntityRid('ri.test.entity1');
      expect(useWorkshopStore.getState().focusedEntityRid).toBe('ri.test.entity1');
    });

    it('clears focus lock', () => {
      useWorkshopStore.getState().setFocusedEntityRid('ri.test.entity1');
      useWorkshopStore.getState().clearFocusLock();
      expect(useWorkshopStore.getState().focusedEntityRid).toBeNull();
    });
  });

  describe('highlightedEntityRids (F016)', () => {
    it('starts empty', () => {
      expect(useWorkshopStore.getState().highlightedEntityRids).toEqual([]);
    });

    it('sets highlighted entities', () => {
      useWorkshopStore.getState().setHighlightedEntityRids(['a', 'b']);
      expect(useWorkshopStore.getState().highlightedEntityRids).toEqual(['a', 'b']);
    });

    it('clears highlights', () => {
      useWorkshopStore.getState().setHighlightedEntityRids(['a']);
      useWorkshopStore.getState().clearHighlights();
      expect(useWorkshopStore.getState().highlightedEntityRids).toEqual([]);
    });
  });

  describe('dragLinkState (F016)', () => {
    const mockDragState = {
      sourceNodeId: 'node1',
      sourcePosition: { x: 0, y: 0, z: 0 },
      currentPointerPosition: { x: 1, y: 1, z: 1 },
      hoveredTargetId: null,
    };

    it('starts null', () => {
      expect(useWorkshopStore.getState().dragLinkState).toBeNull();
    });

    it('sets drag link state', () => {
      useWorkshopStore.getState().setDragLinkState(mockDragState);
      expect(useWorkshopStore.getState().dragLinkState).toEqual(mockDragState);
    });

    it('clears drag link', () => {
      useWorkshopStore.getState().setDragLinkState(mockDragState);
      useWorkshopStore.getState().clearDragLink();
      expect(useWorkshopStore.getState().dragLinkState).toBeNull();
    });
  });

  describe('activeShockwaves (F016)', () => {
    const mockShockwave = { id: 'sw1', position: { x: 0, y: 0, z: 0 }, startTime: 100 };

    it('starts empty', () => {
      expect(useWorkshopStore.getState().activeShockwaves).toEqual([]);
    });

    it('adds shockwave', () => {
      useWorkshopStore.getState().addShockwave(mockShockwave);
      expect(useWorkshopStore.getState().activeShockwaves).toHaveLength(1);
      expect(useWorkshopStore.getState().activeShockwaves[0]?.id).toBe('sw1');
    });

    it('removes shockwave by id', () => {
      useWorkshopStore.getState().addShockwave(mockShockwave);
      useWorkshopStore.getState().addShockwave({ ...mockShockwave, id: 'sw2' });
      useWorkshopStore.getState().removeShockwave('sw1');
      expect(useWorkshopStore.getState().activeShockwaves).toHaveLength(1);
      expect(useWorkshopStore.getState().activeShockwaves[0]?.id).toBe('sw2');
    });
  });

  describe('activeCollapses (F016)', () => {
    const mockCollapse = { id: 'c1', position: { x: 0, y: 0, z: 0 }, color: '#ff0000', startTime: 200 };

    it('starts empty', () => {
      expect(useWorkshopStore.getState().activeCollapses).toEqual([]);
    });

    it('adds collapse', () => {
      useWorkshopStore.getState().addCollapse(mockCollapse);
      expect(useWorkshopStore.getState().activeCollapses).toHaveLength(1);
      expect(useWorkshopStore.getState().activeCollapses[0]?.id).toBe('c1');
    });

    it('removes collapse by id', () => {
      useWorkshopStore.getState().addCollapse(mockCollapse);
      useWorkshopStore.getState().addCollapse({ ...mockCollapse, id: 'c2' });
      useWorkshopStore.getState().removeCollapse('c1');
      expect(useWorkshopStore.getState().activeCollapses).toHaveLength(1);
      expect(useWorkshopStore.getState().activeCollapses[0]?.id).toBe('c2');
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const store = useWorkshopStore.getState();
      store.setPageState('analyzing');
      store.setCurrentSessionRid('ri.test.session');
      store.setConnectionStatus('connected');
      store.setSelectedEntityRid('ri.test.entity');
      store.toggleChatPanel();
      store.addPlanStep({ step: 'Test', index: 0, total: 1 });
      store.addPendingCrystallization({
        rid: 'test',
        itemType: 'object_type',
        suggestion: {},
        confidence: 0.5,
        confidenceLevel: 'medium',
      });
      // F016 fields
      store.setViewMode('2d');
      store.setFocusedEntityRid('ri.test.focus');
      store.setHighlightedEntityRids(['a', 'b']);
      store.setDragLinkState({
        sourceNodeId: 'n1',
        sourcePosition: { x: 0, y: 0, z: 0 },
        currentPointerPosition: { x: 1, y: 1, z: 1 },
        hoveredTargetId: null,
      });
      store.addShockwave({ id: 'sw', position: { x: 0, y: 0, z: 0 }, startTime: 0 });
      store.addCollapse({ id: 'c', position: { x: 0, y: 0, z: 0 }, color: '#f00', startTime: 0 });

      store.reset();

      const s = useWorkshopStore.getState();
      expect(s.pageState).toBe('empty');
      expect(s.currentSessionRid).toBeNull();
      expect(s.connectionStatus).toBe('idle');
      expect(s.selectedEntityRid).toBeNull();
      expect(s.isChatPanelExpanded).toBe(true);
      expect(s.planSteps).toHaveLength(0);
      expect(s.pendingCrystallizations).toHaveLength(0);
      // F016 fields
      expect(s.viewMode).toBe('3d');
      expect(s.focusedEntityRid).toBeNull();
      expect(s.highlightedEntityRids).toEqual([]);
      expect(s.dragLinkState).toBeNull();
      expect(s.activeShockwaves).toEqual([]);
      expect(s.activeCollapses).toEqual([]);
    });
  });
});

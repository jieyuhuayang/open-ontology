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

      store.reset();

      const s = useWorkshopStore.getState();
      expect(s.pageState).toBe('empty');
      expect(s.currentSessionRid).toBeNull();
      expect(s.connectionStatus).toBe('idle');
      expect(s.selectedEntityRid).toBeNull();
      expect(s.isChatPanelExpanded).toBe(true);
      expect(s.planSteps).toHaveLength(0);
      expect(s.pendingCrystallizations).toHaveLength(0);
    });
  });
});

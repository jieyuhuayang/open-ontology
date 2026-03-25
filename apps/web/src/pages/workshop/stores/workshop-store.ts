import { create } from 'zustand';
import type {
  WorkshopPageState,
  PlanStep,
  SSEBlueprintItemData,
  ViewMode,
  DragLinkState,
  ShockwaveInstance,
  CollapseInstance,
} from '../types';

export interface WorkshopStore {
  // Page state
  pageState: WorkshopPageState;
  setPageState: (state: WorkshopPageState) => void;

  // Session
  currentSessionRid: string | null;
  setCurrentSessionRid: (rid: string | null) => void;

  // SSE connection
  connectionStatus: 'idle' | 'connected' | 'reconnecting' | 'disconnected';
  setConnectionStatus: (
    s: 'idle' | 'connected' | 'reconnecting' | 'disconnected',
  ) => void;

  // Entity interaction
  selectedEntityRid: string | null;
  setSelectedEntityRid: (rid: string | null) => void;
  hoveredEntityRid: string | null;
  setHoveredEntityRid: (rid: string | null) => void;

  // Panel visibility
  isChatPanelExpanded: boolean;
  isSidekickOpen: boolean;
  toggleChatPanel: () => void;
  toggleSidekick: () => void;

  // Plan steps (from SSE plan-step events)
  planSteps: PlanStep[];
  addPlanStep: (step: PlanStep) => void;
  clearPlanSteps: () => void;

  // Crystallization queue (from SSE blueprint-item events)
  pendingCrystallizations: SSEBlueprintItemData[];
  addPendingCrystallization: (item: SSEBlueprintItemData) => void;
  consumeCrystallization: (rid: string) => void;

  // F016: View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // F016: Focus lock
  focusedEntityRid: string | null;
  setFocusedEntityRid: (rid: string | null) => void;
  clearFocusLock: () => void;

  // F016: Bidirectional highlighting
  highlightedEntityRids: string[];
  setHighlightedEntityRids: (rids: string[]) => void;
  clearHighlights: () => void;

  // F016: Drag link
  dragLinkState: DragLinkState | null;
  setDragLinkState: (state: DragLinkState | null) => void;
  clearDragLink: () => void;

  // F016: Visual effects
  activeShockwaves: ShockwaveInstance[];
  addShockwave: (instance: ShockwaveInstance) => void;
  removeShockwave: (id: string) => void;

  activeCollapses: CollapseInstance[];
  addCollapse: (instance: CollapseInstance) => void;
  removeCollapse: (id: string) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  pageState: 'empty' as WorkshopPageState,
  currentSessionRid: null,
  connectionStatus: 'idle' as const,
  selectedEntityRid: null,
  hoveredEntityRid: null,
  isChatPanelExpanded: true,
  isSidekickOpen: true,
  planSteps: [] as PlanStep[],
  pendingCrystallizations: [] as SSEBlueprintItemData[],
  viewMode: '3d' as ViewMode,
  focusedEntityRid: null as string | null,
  highlightedEntityRids: [] as string[],
  dragLinkState: null as DragLinkState | null,
  activeShockwaves: [] as ShockwaveInstance[],
  activeCollapses: [] as CollapseInstance[],
};

export const useWorkshopStore = create<WorkshopStore>((set) => ({
  ...initialState,

  setPageState: (pageState) => set({ pageState }),
  setCurrentSessionRid: (currentSessionRid) => set({ currentSessionRid }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setSelectedEntityRid: (selectedEntityRid) => set({ selectedEntityRid }),
  setHoveredEntityRid: (hoveredEntityRid) => set({ hoveredEntityRid }),

  toggleChatPanel: () =>
    set((s) => ({ isChatPanelExpanded: !s.isChatPanelExpanded })),
  toggleSidekick: () => set((s) => ({ isSidekickOpen: !s.isSidekickOpen })),

  addPlanStep: (step) =>
    set((s) => ({ planSteps: [...s.planSteps, step] })),
  clearPlanSteps: () => set({ planSteps: [] }),

  addPendingCrystallization: (item) =>
    set((s) => ({
      pendingCrystallizations: [...s.pendingCrystallizations, item],
    })),
  consumeCrystallization: (rid) =>
    set((s) => ({
      pendingCrystallizations: s.pendingCrystallizations.filter(
        (c) => c.rid !== rid,
      ),
    })),

  // F016: View mode
  setViewMode: (viewMode) => set({ viewMode }),

  // F016: Focus lock
  setFocusedEntityRid: (focusedEntityRid) => set({ focusedEntityRid }),
  clearFocusLock: () => set({ focusedEntityRid: null }),

  // F016: Bidirectional highlighting
  setHighlightedEntityRids: (highlightedEntityRids) =>
    set({ highlightedEntityRids }),
  clearHighlights: () => set({ highlightedEntityRids: [] }),

  // F016: Drag link
  setDragLinkState: (dragLinkState) => set({ dragLinkState }),
  clearDragLink: () => set({ dragLinkState: null }),

  // F016: Visual effects
  addShockwave: (instance) =>
    set((s) => ({
      activeShockwaves: [...s.activeShockwaves, instance],
    })),
  removeShockwave: (id) =>
    set((s) => ({
      activeShockwaves: s.activeShockwaves.filter((sw) => sw.id !== id),
    })),
  addCollapse: (instance) =>
    set((s) => ({
      activeCollapses: [...s.activeCollapses, instance],
    })),
  removeCollapse: (id) =>
    set((s) => ({
      activeCollapses: s.activeCollapses.filter((c) => c.id !== id),
    })),

  reset: () => set(initialState),
}));

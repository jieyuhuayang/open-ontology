import { create } from 'zustand';
import type { PropertyBaseType } from '@/api/types';

export interface WizardProperty {
  id: string;
  displayName: string;
  baseType: PropertyBaseType;
  columnName?: string;
  isPrimaryKey?: boolean;
  isTitleKey?: boolean;
}

interface CreateWizardStore {
  isOpen: boolean;
  currentStep: number;
  selectedDatasetRid: string | null;
  displayName: string;
  description: string;
  icon: { name: string; color: string };
  properties: WizardProperty[];
  intendedActions: string[];
  projectRid: string;

  open: () => void;
  close: () => void;
  reset: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setSelectedDataset: (rid: string | null) => void;
  setMetadata: (
    data: Partial<{
      displayName: string;
      description: string;
      icon: { name: string; color: string };
    }>,
  ) => void;
  addProperty: (property: WizardProperty) => void;
  removeProperty: (propertyId: string) => void;
  updateProperty: (propertyId: string, updates: Partial<WizardProperty>) => void;
  setProperties: (properties: WizardProperty[]) => void;
  setIntendedActions: (actions: string[]) => void;
  setProjectRid: (rid: string) => void;
}

const DEFAULT_STATE = {
  isOpen: false,
  currentStep: 0,
  selectedDatasetRid: null,
  displayName: '',
  description: '',
  icon: { name: 'AppstoreOutlined', color: '#1677ff' },
  properties: [] as WizardProperty[],
  intendedActions: [] as string[],
  projectRid: 'ri.ontology.space.default',
};

export const useCreateWizardStore = create<CreateWizardStore>()((set) => ({
  ...DEFAULT_STATE,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  reset: () => set({ ...DEFAULT_STATE }),

  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, 4),
    })),

  prevStep: () =>
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 0),
    })),

  setSelectedDataset: (rid) => set({ selectedDatasetRid: rid }),

  setMetadata: (data) =>
    set((state) => ({
      displayName: data.displayName ?? state.displayName,
      description: data.description ?? state.description,
      icon: data.icon ?? state.icon,
    })),

  addProperty: (property) =>
    set((state) => ({
      properties: [...state.properties, property],
    })),

  removeProperty: (propertyId) =>
    set((state) => ({
      properties: state.properties.filter((p) => p.id !== propertyId),
    })),

  updateProperty: (propertyId, updates) =>
    set((state) => ({
      properties: state.properties.map((p) =>
        p.id === propertyId ? { ...p, ...updates } : p,
      ),
    })),

  setProperties: (properties) => set({ properties }),

  setIntendedActions: (actions) => set({ intendedActions: actions }),

  setProjectRid: (rid) => set({ projectRid: rid }),
}));

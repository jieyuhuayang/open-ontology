import { create } from 'zustand';

interface SaveDialogState {
  open: boolean;
  activeTab: 'changes' | 'errors';
  openDialog: (tab?: 'changes' | 'errors') => void;
  closeDialog: () => void;
  setActiveTab: (tab: 'changes' | 'errors') => void;
}

export const useSaveDialogStore = create<SaveDialogState>((set) => ({
  open: false,
  activeTab: 'changes',
  openDialog: (tab) => set({ open: true, activeTab: tab ?? 'changes' }),
  closeDialog: () => set({ open: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

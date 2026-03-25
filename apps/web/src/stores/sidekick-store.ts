import { create } from 'zustand';

interface SidekickStore {
  isOpen: boolean;
  editingSuggestionId: string | null;
  ignoredSuggestionIds: Set<string>;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setEditingSuggestionId: (id: string | null) => void;
  ignoreSuggestion: (id: string) => void;
  resetIgnored: () => void;
}

export const useSidekickStore = create<SidekickStore>((set) => ({
  isOpen: false,
  editingSuggestionId: null,
  ignoredSuggestionIds: new Set<string>(),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, editingSuggestionId: null }),
  setEditingSuggestionId: (id) => set({ editingSuggestionId: id }),
  ignoreSuggestion: (id) =>
    set((state) => ({
      ignoredSuggestionIds: new Set([...state.ignoredSuggestionIds, id]),
    })),
  resetIgnored: () => set({ ignoredSuggestionIds: new Set<string>() }),
}));

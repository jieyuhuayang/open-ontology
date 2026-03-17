import { create } from 'zustand';

export type SearchActiveType = 'all' | 'objectType' | 'property' | 'linkType';

interface SearchStore {
  query: string;
  isSearchMode: boolean;
  activeType: SearchActiveType;
  setQuery: (q: string) => void;
  setActiveType: (type: SearchActiveType) => void;
  enterSearchMode: () => void;
  exitSearchMode: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  query: '',
  isSearchMode: false,
  activeType: 'all',
  setQuery: (q: string) => set({ query: q }),
  setActiveType: (type: SearchActiveType) => set({ activeType: type }),
  enterSearchMode: () => set({ isSearchMode: true }),
  exitSearchMode: () => set({ query: '', isSearchMode: false, activeType: 'all' }),
}));

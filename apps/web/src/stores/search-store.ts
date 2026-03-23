import { create } from 'zustand';

export type SearchActiveType = 'all' | 'objectType' | 'property' | 'linkType';

interface SearchStore {
  /** Raw input value — updates immediately on every keystroke. */
  inputValue: string;
  /** Debounced query — used by useSearch() to trigger API calls. */
  query: string;
  isSearchMode: boolean;
  activeType: SearchActiveType;
  setInputValue: (v: string) => void;
  setQuery: (q: string) => void;
  setActiveType: (type: SearchActiveType) => void;
  enterSearchMode: () => void;
  exitSearchMode: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  inputValue: '',
  query: '',
  isSearchMode: false,
  activeType: 'all',
  setInputValue: (v: string) => set({ inputValue: v }),
  setQuery: (q: string) => set({ query: q }),
  setActiveType: (type: SearchActiveType) => set({ activeType: type }),
  enterSearchMode: () => set({ isSearchMode: true }),
  exitSearchMode: () => set({ inputValue: '', query: '', isSearchMode: false, activeType: 'all' }),
}));

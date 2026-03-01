import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_ITEMS = 6;

export interface RecentlyViewedItem {
  rid: string;
  displayName: string;
  icon: { name: string; color: string };
  description?: string;
  viewedAt: number;
}

interface RecentlyViewedStore {
  items: RecentlyViewedItem[];
  addItem: (item: Omit<RecentlyViewedItem, 'viewedAt'>) => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const now = Date.now();
          const filtered = state.items.filter((i) => i.rid !== item.rid);
          const updated = [{ ...item, viewedAt: now }, ...filtered];
          return { items: updated.slice(0, MAX_ITEMS) };
        }),
    }),
    { name: 'recently-viewed' },
  ),
);

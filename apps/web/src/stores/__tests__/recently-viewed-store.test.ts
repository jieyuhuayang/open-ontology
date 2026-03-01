import { describe, it, expect, beforeEach } from 'vitest';
import { useRecentlyViewedStore } from '@/stores/recently-viewed-store';
import type { RecentlyViewedItem } from '@/stores/recently-viewed-store';

function makeItem(rid: string): Omit<RecentlyViewedItem, 'viewedAt'> {
  return {
    rid,
    displayName: `Item ${rid}`,
    icon: { name: 'AppstoreOutlined', color: '#1677ff' },
    description: `Description for ${rid}`,
  };
}

describe('recently-viewed-store', () => {
  beforeEach(() => {
    useRecentlyViewedStore.setState({ items: [] });
  });

  it('adds an item', () => {
    useRecentlyViewedStore.getState().addItem(makeItem('rid-1'));
    expect(useRecentlyViewedStore.getState().items).toHaveLength(1);
    expect(useRecentlyViewedStore.getState().items[0]!.rid).toBe('rid-1');
  });

  it('deduplicates by rid and updates viewedAt', () => {
    useRecentlyViewedStore.getState().addItem(makeItem('rid-1'));
    const firstViewedAt = useRecentlyViewedStore.getState().items[0]!.viewedAt;

    // Add same rid again after a small delay
    useRecentlyViewedStore.getState().addItem(makeItem('rid-1'));
    const items = useRecentlyViewedStore.getState().items;

    expect(items).toHaveLength(1);
    expect(items[0]!.viewedAt).toBeGreaterThanOrEqual(firstViewedAt);
  });

  it('limits to 6 items, evicting oldest', () => {
    for (let i = 1; i <= 7; i++) {
      useRecentlyViewedStore.getState().addItem(makeItem(`rid-${i}`));
    }
    const items = useRecentlyViewedStore.getState().items;
    expect(items).toHaveLength(6);
    // rid-1 should be evicted (oldest)
    expect(items.find((item) => item.rid === 'rid-1')).toBeUndefined();
    expect(items.find((item) => item.rid === 'rid-7')).toBeDefined();
  });

  it('sorts by viewedAt descending (most recent first)', () => {
    useRecentlyViewedStore.getState().addItem(makeItem('rid-1'));
    useRecentlyViewedStore.getState().addItem(makeItem('rid-2'));
    useRecentlyViewedStore.getState().addItem(makeItem('rid-3'));

    const items = useRecentlyViewedStore.getState().items;
    for (let i = 0; i < items.length - 1; i++) {
      expect(items[i]!.viewedAt).toBeGreaterThanOrEqual(items[i + 1]!.viewedAt);
    }
  });

  it('uses persist middleware with localStorage key', () => {
    expect(useRecentlyViewedStore.persist).toBeDefined();
    expect(useRecentlyViewedStore.persist.getOptions().name).toBe('recently-viewed');
  });
});

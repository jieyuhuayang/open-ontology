import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchStore } from '../search-store';

describe('search-store', () => {
  beforeEach(() => {
    useSearchStore.setState({ query: '', isSearchMode: false, activeType: 'all' });
  });

  it('enters search mode', () => {
    const store = useSearchStore.getState();
    store.setQuery('test');
    store.enterSearchMode();
    const state = useSearchStore.getState();
    expect(state.query).toBe('test');
    expect(state.isSearchMode).toBe(true);
  });

  it('exits search mode and resets state', () => {
    const store = useSearchStore.getState();
    store.setQuery('test');
    store.enterSearchMode();
    store.setActiveType('objectType');
    store.exitSearchMode();
    const state = useSearchStore.getState();
    expect(state.query).toBe('');
    expect(state.isSearchMode).toBe(false);
    expect(state.activeType).toBe('all');
  });

  it('sets active type', () => {
    const store = useSearchStore.getState();
    store.setActiveType('property');
    expect(useSearchStore.getState().activeType).toBe('property');
    store.setActiveType('linkType');
    expect(useSearchStore.getState().activeType).toBe('linkType');
  });
});

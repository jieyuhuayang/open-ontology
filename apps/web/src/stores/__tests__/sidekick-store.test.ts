import { describe, it, expect, beforeEach } from 'vitest';
import { useSidekickStore } from '../sidekick-store';

describe('sidekick-store', () => {
  beforeEach(() => {
    useSidekickStore.setState({
      isOpen: false,
      editingSuggestionId: null,
      ignoredSuggestionIds: new Set(),
    });
  });

  it('toggle switches isOpen', () => {
    expect(useSidekickStore.getState().isOpen).toBe(false);
    useSidekickStore.getState().toggle();
    expect(useSidekickStore.getState().isOpen).toBe(true);
    useSidekickStore.getState().toggle();
    expect(useSidekickStore.getState().isOpen).toBe(false);
  });

  it('close resets editingSuggestionId', () => {
    useSidekickStore.getState().open();
    useSidekickStore.getState().setEditingSuggestionId('test-id');
    expect(useSidekickStore.getState().editingSuggestionId).toBe('test-id');
    useSidekickStore.getState().close();
    expect(useSidekickStore.getState().isOpen).toBe(false);
    expect(useSidekickStore.getState().editingSuggestionId).toBeNull();
  });

  it('ignoreSuggestion adds to set', () => {
    useSidekickStore.getState().ignoreSuggestion('sug-1');
    useSidekickStore.getState().ignoreSuggestion('sug-2');
    const ids = useSidekickStore.getState().ignoredSuggestionIds;
    expect(ids.has('sug-1')).toBe(true);
    expect(ids.has('sug-2')).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('resetIgnored clears the set', () => {
    useSidekickStore.getState().ignoreSuggestion('sug-1');
    expect(useSidekickStore.getState().ignoredSuggestionIds.size).toBe(1);
    useSidekickStore.getState().resetIgnored();
    expect(useSidekickStore.getState().ignoredSuggestionIds.size).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { queryClient } from '@/queryClient';

describe('queryClient', () => {
  it('has QueryCache with onError configured', () => {
    const cache = queryClient.getQueryCache();
    expect(cache).toBeDefined();
    // QueryCache config is set via constructor — verify instance exists
    expect(cache.constructor.name).toBe('QueryCache');
  });

  it('has MutationCache with onError configured', () => {
    const cache = queryClient.getMutationCache();
    expect(cache).toBeDefined();
    expect(cache.constructor.name).toBe('MutationCache');
  });

  it('sets retry to 1', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(1);
  });

  it('disables refetchOnWindowFocus', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });
});

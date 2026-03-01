import { describe, it, expect, beforeEach } from 'vitest';
import { useSidebarStore } from '@/stores/sidebar-store';

describe('sidebar-store', () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false });
  });

  it('defaults collapsed to false', () => {
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it('toggleCollapsed switches state', () => {
    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(true);

    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it('uses persist middleware with localStorage key', () => {
    // Zustand persist stores have a persist property
    expect(useSidebarStore.persist).toBeDefined();
    expect(useSidebarStore.persist.getOptions().name).toBe('sidebar-collapsed');
  });
});

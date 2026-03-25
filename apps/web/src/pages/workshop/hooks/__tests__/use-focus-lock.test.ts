import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusLock } from '../use-focus-lock';
import { useWorkshopStore } from '../../stores/workshop-store';
import type { WorkshopNode } from '../../types';

const makeNode = (id: string, name: string): WorkshopNode => ({
  id,
  type: 'object_type',
  displayName: name,
  color: '#fff',
  position: { x: 0, y: 0, z: 0 },
  status: 'pending',
  confidence: 0.9,
  confidenceLevel: 'high',
});

describe('useFocusLock', () => {
  beforeEach(() => {
    useWorkshopStore.getState().reset();
  });

  it('returns null focusedEntity when no entity is locked', () => {
    const nodes = [makeNode('n1', 'Order')];
    const { result } = renderHook(() => useFocusLock(nodes));
    expect(result.current.focusedEntity).toBeNull();
  });

  it('returns the focused entity after lockEntity', () => {
    const nodes = [makeNode('n1', 'Order'), makeNode('n2', 'Product')];
    const { result } = renderHook(() => useFocusLock(nodes));

    act(() => result.current.lockEntity('n1'));
    expect(result.current.focusedEntity?.displayName).toBe('Order');
  });

  it('clears focus on unlockEntity', () => {
    const nodes = [makeNode('n1', 'Order')];
    const { result } = renderHook(() => useFocusLock(nodes));

    act(() => result.current.lockEntity('n1'));
    act(() => result.current.unlockEntity());
    expect(result.current.focusedEntity).toBeNull();
  });

  it('prefixMessage adds entity context when locked', () => {
    const nodes = [makeNode('n1', 'Order')];
    const { result } = renderHook(() => useFocusLock(nodes));

    act(() => result.current.lockEntity('n1'));
    expect(result.current.prefixMessage('reduce fields')).toBe(
      '[关于 Order] reduce fields',
    );
  });

  it('prefixMessage returns original content when not locked', () => {
    const nodes = [makeNode('n1', 'Order')];
    const { result } = renderHook(() => useFocusLock(nodes));
    expect(result.current.prefixMessage('reduce fields')).toBe('reduce fields');
  });

  it('auto-clears focus when locked entity is removed from nodes', () => {
    let nodes = [makeNode('n1', 'Order'), makeNode('n2', 'Product')];
    const { result, rerender } = renderHook(() => useFocusLock(nodes));

    act(() => result.current.lockEntity('n1'));
    expect(result.current.focusedEntity?.id).toBe('n1');

    // Remove n1 from nodes
    nodes = [makeNode('n2', 'Product')];
    rerender();

    expect(result.current.focusedEntity).toBeNull();
  });
});

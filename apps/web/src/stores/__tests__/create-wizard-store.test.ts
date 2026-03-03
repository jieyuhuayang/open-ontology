import { describe, it, expect, beforeEach } from 'vitest';
import { useCreateWizardStore } from '@/stores/create-wizard-store';

describe('create-wizard-store', () => {
  beforeEach(() => {
    useCreateWizardStore.getState().reset();
  });

  it('should NOT have objectTypeId in state', () => {
    const state = useCreateWizardStore.getState();
    expect('objectTypeId' in state).toBe(false);
  });

  it('setMetadata updates displayName and description', () => {
    useCreateWizardStore.getState().setMetadata({
      displayName: 'Aircraft',
      description: 'An aircraft object type',
    });
    const state = useCreateWizardStore.getState();
    expect(state.displayName).toBe('Aircraft');
    expect(state.description).toBe('An aircraft object type');
  });

  it('setMetadata does NOT accept objectTypeId', () => {
    // setMetadata signature should not include objectTypeId
    const metadata = { displayName: 'Test' };
    useCreateWizardStore.getState().setMetadata(metadata);
    expect(useCreateWizardStore.getState().displayName).toBe('Test');
  });

  it('setProperties replaces the entire properties array', () => {
    const store = useCreateWizardStore.getState();
    store.addProperty({
      id: 'p1',
      displayName: 'Name',
      baseType: 'string',
    });
    expect(useCreateWizardStore.getState().properties).toHaveLength(1);

    store.setProperties([
      { id: 'p2', displayName: 'Age', baseType: 'integer' },
      { id: 'p3', displayName: 'Active', baseType: 'boolean' },
    ]);
    const props = useCreateWizardStore.getState().properties;
    expect(props).toHaveLength(2);
    expect(props[0]!.id).toBe('p2');
    expect(props[1]!.id).toBe('p3');
  });

  it('setProperties can set isPrimaryKey / isTitleKey', () => {
    useCreateWizardStore.getState().setProperties([
      { id: 'p1', displayName: 'ID', baseType: 'string', isPrimaryKey: true },
      { id: 'p2', displayName: 'Name', baseType: 'string', isTitleKey: true },
    ]);
    const props = useCreateWizardStore.getState().properties;
    expect(props[0]!.isPrimaryKey).toBe(true);
    expect(props[1]!.isTitleKey).toBe(true);
  });

  it('reset clears all state', () => {
    useCreateWizardStore.getState().setMetadata({ displayName: 'Test' });
    useCreateWizardStore.getState().addProperty({
      id: 'p1',
      displayName: 'Name',
      baseType: 'string',
    });
    useCreateWizardStore.getState().reset();

    const state = useCreateWizardStore.getState();
    expect(state.displayName).toBe('');
    expect(state.properties).toHaveLength(0);
  });
});

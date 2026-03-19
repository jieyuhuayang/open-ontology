import { describe, it, expect, beforeEach } from 'vitest';
import { useSaveDialogStore } from '@/stores/save-dialog-store';

describe('save-dialog-store', () => {
  beforeEach(() => {
    useSaveDialogStore.setState({ open: false, activeTab: 'changes' });
  });

  it('defaults to closed with changes tab', () => {
    const state = useSaveDialogStore.getState();
    expect(state.open).toBe(false);
    expect(state.activeTab).toBe('changes');
  });

  it('openDialog sets open=true and activeTab=changes by default', () => {
    useSaveDialogStore.getState().openDialog();
    const state = useSaveDialogStore.getState();
    expect(state.open).toBe(true);
    expect(state.activeTab).toBe('changes');
  });

  it('openDialog with errors tab sets activeTab=errors', () => {
    useSaveDialogStore.getState().openDialog('errors');
    const state = useSaveDialogStore.getState();
    expect(state.open).toBe(true);
    expect(state.activeTab).toBe('errors');
  });

  it('closeDialog sets open=false', () => {
    useSaveDialogStore.getState().openDialog();
    useSaveDialogStore.getState().closeDialog();
    expect(useSaveDialogStore.getState().open).toBe(false);
  });

  it('setActiveTab updates tab', () => {
    useSaveDialogStore.getState().setActiveTab('errors');
    expect(useSaveDialogStore.getState().activeTab).toBe('errors');

    useSaveDialogStore.getState().setActiveTab('changes');
    expect(useSaveDialogStore.getState().activeTab).toBe('changes');
  });
});

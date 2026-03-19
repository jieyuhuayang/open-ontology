import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import ChangeActions from '@/components/ChangeActions';
import { useSaveDialogStore } from '@/stores/save-dialog-store';

const mockChanges = [
  {
    id: 'chg-1',
    resourceType: 'ObjectType',
    resourceRid: 'ri.ontology.object-type.abc',
    changeType: 'CREATE',
    before: null,
    after: { displayName: 'Test' },
    timestamp: '2026-01-01T00:00:00Z',
  },
];

const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/api/working-state', () => ({
  useWorkingState: vi.fn(() => ({
    data: { changes: mockChanges },
    isLoading: false,
    error: null,
  })),
  useDiscardAll: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  DEFAULT_ONTOLOGY_RID: 'ri.ontology.ontology.default',
}));

function renderWithProviders() {
  // Create portal target
  const slot = document.createElement('div');
  slot.id = 'change-status-slot';
  document.body.appendChild(slot);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ChangeActions />
    </QueryClientProvider>,
  );
  return { ...result, slot };
}

describe('ChangeActions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useSaveDialogStore.setState({ open: false, activeTab: 'changes' });
    mockMutateAsync.mockClear();
  });

  it('renders Save and Discard buttons when there are changes', () => {
    renderWithProviders();
    expect(screen.getByText(/Save \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Discard/)).toBeInTheDocument();
  });

  it('does not render when there are no changes', async () => {
    const { useWorkingState } = await import('@/api/working-state');
    vi.mocked(useWorkingState).mockReturnValue({
      data: { changes: [] },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useWorkingState>);

    renderWithProviders();
    expect(screen.queryByText(/Save/)).not.toBeInTheDocument();

    // Restore
    vi.mocked(useWorkingState).mockReturnValue({
      data: { changes: mockChanges },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useWorkingState>);
  });

  it('clicking Save opens dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await user.click(screen.getByText(/Save \(1\)/));
    expect(useSaveDialogStore.getState().open).toBe(true);
  });

  it('clicking Discard shows confirm modal', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await user.click(screen.getByText(/Discard/));
    // Ant Design Modal.confirm renders in document.body
    expect(document.body.textContent).toContain('Discard all changes?');
  });
});

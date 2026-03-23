import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ChangeActions from '@/components/ChangeActions';
import { useSaveDialogStore } from '@/stores/save-dialog-store';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

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
  const slot = document.createElement('div');
  slot.id = 'change-status-slot';
  document.body.appendChild(slot);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChangeActions />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, slot };
}

describe('ChangeActions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useSaveDialogStore.setState({ open: false, activeTab: 'changes' });
    mockMutateAsync.mockClear();
    mockNavigate.mockClear();
  });

  it('always renders History button even without changes', async () => {
    const { useWorkingState } = await import('@/api/working-state');
    vi.mocked(useWorkingState).mockReturnValue({
      data: { changes: [] },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useWorkingState>);

    renderWithProviders();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.queryByText(/edits/)).not.toBeInTheDocument();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();

    // Restore
    vi.mocked(useWorkingState).mockReturnValue({
      data: { changes: mockChanges },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useWorkingState>);
  });

  it('renders Save, Discard, edits count and History when there are changes', () => {
    renderWithProviders();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('1 edits')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Discard')).toBeInTheDocument();
  });

  it('shows +N badge on History button when changes exist', () => {
    renderWithProviders();
    // Ant Design Badge splits "+1" into separate scroll-number spans; check via title attribute
    expect(document.querySelector('[title="+1"]')).toBeInTheDocument();
  });

  it('clicking History navigates to /history', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await user.click(screen.getByText('History'));
    expect(mockNavigate).toHaveBeenCalledWith('/history');
  });

  it('clicking edits count opens save dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await user.click(screen.getByText('1 edits'));
    expect(useSaveDialogStore.getState().open).toBe(true);
  });

  it('clicking Save opens dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await user.click(screen.getByText('Save'));
    expect(useSaveDialogStore.getState().open).toBe(true);
  });

  it('clicking Discard shows confirm modal', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await user.click(screen.getByText('Discard'));
    expect(document.body.textContent).toContain('Discard all changes?');
  });
});

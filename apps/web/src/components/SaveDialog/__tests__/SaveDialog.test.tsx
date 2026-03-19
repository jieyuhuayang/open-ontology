import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import SaveDialog from '@/components/SaveDialog/SaveDialog';
import { useSaveDialogStore } from '@/stores/save-dialog-store';

const validChanges = [
  {
    id: 'chg-1',
    resourceType: 'ObjectType',
    resourceRid: 'ri.ontology.object-type.abc',
    changeType: 'CREATE',
    before: null,
    after: { displayName: 'Employee' },
    timestamp: '2026-01-01T00:00:00Z',
  },
];

const invalidChanges = [
  {
    id: 'chg-2',
    resourceType: 'ObjectType',
    resourceRid: 'ri.ontology.object-type.def',
    changeType: 'CREATE',
    before: null,
    after: {} as Record<string, unknown>,
    timestamp: '2026-01-01T00:00:00Z',
  },
];

let mockChanges: typeof validChanges | typeof invalidChanges = validChanges;

vi.mock('@/api/working-state', () => ({
  useWorkingState: () => ({
    data: { changes: mockChanges },
    isLoading: false,
  }),
  usePublish: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useDiscardAll: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
  useDiscardChange: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  DEFAULT_ONTOLOGY_RID: 'ri.ontology.ontology.default',
}));

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App>
          <SaveDialog />
        </App>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SaveDialog', () => {
  beforeEach(() => {
    mockChanges = validChanges;
    useSaveDialogStore.setState({ open: true, activeTab: 'changes' });
  });

  it('renders Changes and Errors tabs', () => {
    renderDialog();
    expect(screen.getByRole('tab', { name: /Changes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Errors/i })).toBeInTheDocument();
  });

  it('shows change items grouped by resource type', () => {
    renderDialog();
    expect(screen.getByText('Employee')).toBeInTheDocument();
    expect(screen.getByText(/Object Types/)).toBeInTheDocument();
  });

  it('Save button is enabled when no errors', () => {
    renderDialog();
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('Save button is disabled when there are errors', () => {
    mockChanges = invalidChanges;
    renderDialog();
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    expect(saveBtn).toBeDisabled();
  });

  it('Discard all button is present', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /Discard all/i })).toBeInTheDocument();
  });
});

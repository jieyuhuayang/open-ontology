import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LiveConnectionWizard from '@/pages/data-connection/components/LiveConnectionWizard';
import { useDataConnectionStore } from '@/stores/data-connection-store';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const mockRegisterLive = vi.fn();

vi.mock('@/api/mysql-connections', () => ({
  useMySQLConnections: vi.fn(() => ({
    data: [
      { rid: 'conn-1', name: 'TestDB', host: 'localhost', port: 3306, databaseName: 'testdb' },
    ],
  })),
  useMySQLTables: vi.fn(() => ({
    data: [{ name: 'orders', rowCount: 500 }],
    isLoading: false,
  })),
  useMySQLTableColumns: vi.fn(() => ({
    data: [
      { name: 'id', dataType: 'int', isPrimaryKey: true, isNullable: false },
      { name: 'total', dataType: 'decimal', isPrimaryKey: false, isNullable: true },
    ],
    isLoading: false,
  })),
  useMySQLImportedTables: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/api/imports', () => ({
  useRegisterLiveDataset: vi.fn(() => ({
    mutateAsync: mockRegisterLive,
    isPending: false,
  })),
}));

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LiveConnectionWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LiveConnectionWizard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useDataConnectionStore.getState().setOpenModal('liveConnection');
    mockRegisterLive.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows Live Connection banner on step 0', async () => {
    renderWizard();
    expect(screen.getByText(/Live Connection mode/i)).toBeInTheDocument();
  });

  it('shows empty state when no connections', async () => {
    const { useMySQLConnections } = await import('@/api/mysql-connections');
    (useMySQLConnections as ReturnType<typeof vi.fn>).mockReturnValueOnce({ data: [] });
    renderWizard();
    // Should show no connections message
    expect(screen.getByText(/No connections available/i)).toBeInTheDocument();
  });

  it('navigates to step 1 and shows table + columns after selecting connection', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWizard();

    // Select connection
    const connectionSelect = screen.getByRole('combobox');
    await user.click(connectionSelect);
    const option = await screen.findByText(/TestDB/);
    await user.click(option);

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);

    // Should show table list
    await waitFor(() => {
      expect(screen.getByText('orders')).toBeInTheDocument();
    });

    // Select table
    await user.click(screen.getByText('orders'));

    // Advance timers for column auto-select
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    // Should show column checkboxes
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('calls registerLiveDataset on confirm', async () => {
    mockRegisterLive.mockResolvedValue({
      rid: 'ri.ontology.dataset.live1',
      name: 'orders',
      mode: 'live',
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWizard();

    // Step 0: select connection and go next
    const connectionSelect = screen.getByRole('combobox');
    await user.click(connectionSelect);
    await user.click(await screen.findByText(/TestDB/));
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 1: select table
    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    await user.click(screen.getByText('orders'));

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    // Wait for register button to appear and click
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(mockRegisterLive).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionRid: 'conn-1',
        tableName: 'orders',
        datasetName: 'orders',
      }),
    );
  });
});

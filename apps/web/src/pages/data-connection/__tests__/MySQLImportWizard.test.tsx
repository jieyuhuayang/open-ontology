import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MySQLImportWizard from '@/pages/data-connection/components/MySQLImportWizard';
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

vi.mock('@/api/mysql-connections', () => ({
  useMySQLConnections: vi.fn(() => ({
    data: [
      { rid: 'conn-1', name: 'TestDB', host: 'localhost', port: 3306, databaseName: 'testdb' },
    ],
  })),
  useMySQLTables: vi.fn(() => ({
    data: [{ name: 'users', rowCount: 100 }],
    isLoading: false,
  })),
  useMySQLTableColumns: vi.fn(() => ({
    data: [
      { name: 'id', dataType: 'int', isPrimaryKey: true, isNullable: false },
      { name: 'name', dataType: 'varchar', isPrimaryKey: false, isNullable: true },
      { name: 'email', dataType: 'varchar', isPrimaryKey: false, isNullable: true },
    ],
    isLoading: false,
  })),
  useMySQLImportedTables: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/api/imports', () => ({
  useMySQLImport: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useImportTask: vi.fn(() => ({ data: null })),
}));

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MySQLImportWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function advanceToStep2(user: ReturnType<typeof userEvent.setup>) {
  // Step 0: Select a connection
  const connectionSelect = screen.getByRole('combobox');
  await user.click(connectionSelect);
  const option = await screen.findByText(/TestDB/);
  await user.click(option);

  // Click Next to go to step 1 (tables)
  const nextBtn = screen.getByRole('button', { name: /next/i });
  await user.click(nextBtn);

  // Step 1: Select a table row by clicking on it
  const tableRow = await screen.findByText('users');
  await user.click(tableRow);

  // Click Next to go to step 2 (column config)
  const nextBtn2 = screen.getByRole('button', { name: /next/i });
  await user.click(nextBtn2);
}

describe('MySQLImportWizard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useDataConnectionStore.getState().setOpenModal('mysqlImport');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('selects all columns by default when entering step 2', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWizard();

    await advanceToStep2(user);

    // Advance timers to let the setTimeout fire
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    // Wait for all column checkboxes to be checked
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
      for (const cb of checkboxes) {
        expect(cb).toBeChecked();
      }
    });
  });

  it('PK column checkbox is disabled', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWizard();

    await advanceToStep2(user);

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    const checkboxes = screen.getAllByRole('checkbox');
    // 'id' (PK) should be disabled
    const pkCheckbox = checkboxes[0];
    expect(pkCheckbox).toBeDisabled();

    // Non-PK should not be disabled
    expect(checkboxes[1]).not.toBeDisabled();
    expect(checkboxes[2]).not.toBeDisabled();
  });
});

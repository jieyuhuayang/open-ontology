import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MySQLImportWizard from '@/pages/data-connection/components/MySQLImportWizard';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type { MySQLColumnInfo } from '@/api/types';

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

const mockColumns: MySQLColumnInfo[] = [
  { name: 'id', dataType: 'int', isPrimaryKey: true, isNullable: false },
  { name: 'name', dataType: 'varchar', isPrimaryKey: false, isNullable: true },
  { name: 'email', dataType: 'varchar', isPrimaryKey: false, isNullable: true },
] as MySQLColumnInfo[];

// Track step state across mocks
let mockStep = 2;

vi.mock('@/api/mysql-connections', () => ({
  useMySQLConnections: vi.fn(() => ({
    data: [{ rid: 'conn-1', name: 'TestDB', host: 'localhost', port: 3306, databaseName: 'testdb' }],
  })),
  useMySQLTables: vi.fn(() => ({
    data: [{ name: 'users', rowCount: 100 }],
    isLoading: false,
  })),
  useMySQLTableColumns: vi.fn(() => ({
    data: mockColumns,
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

// Mock useState to start at step 2 with a selected table
const originalUseState = await import('react').then((m) => m.useState);

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: (init: unknown) => {
      // Intercept initial step to start at step 2
      if (init === 0 && mockStep === 2) {
        mockStep = -1; // Only intercept once
        return (actual as typeof import('react')).useState(2);
      }
      // Intercept selectedTable
      if (init === null && mockStep === -1) {
        mockStep = -2; // Only intercept once
        return (actual as typeof import('react')).useState({ name: 'users', rowCount: 100 });
      }
      return (actual as typeof import('react')).useState(init);
    },
  };
});

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

describe('MySQLImportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStep = 2;
    useDataConnectionStore.getState().setOpenModal('mysqlImport');
  });

  it('selects all columns by default when entering step 2', async () => {
    renderWizard();

    // Wait for columns to render and setTimeout to fire
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    // All checkboxes should be checked
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      expect(cb).toBeChecked();
    }
  });

  it('PK column checkbox is disabled', async () => {
    renderWizard();

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    // Find the PK checkbox (id column) - it should be disabled
    const checkboxes = screen.getAllByRole('checkbox');
    // The first checkbox corresponds to 'id' (PK)
    const pkCheckbox = checkboxes[0];
    expect(pkCheckbox).toBeDisabled();

    // Non-PK checkboxes should not be disabled
    expect(checkboxes[1]).not.toBeDisabled();
    expect(checkboxes[2]).not.toBeDisabled();
  });
});

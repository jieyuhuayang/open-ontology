import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ObjectTypeDatasourcesPage from '../ObjectTypeDatasourcesPage';

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

const OT_RID = 'ri.ontology.object-type.test';
const DS_RID = 'ri.dataset.test-ds';

const mockUpdateMutateAsync = vi.fn();
let mockObjectType: Record<string, unknown> | undefined;
let mockDataset: Record<string, unknown> | undefined;
let mockPreview: Record<string, unknown> | undefined;
let mockDatasetsData: Record<string, unknown> | undefined;

vi.mock('@/api/object-types', () => ({
  useObjectType: vi.fn(() => ({ data: mockObjectType })),
  useUpdateObjectType: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
  objectTypeKeys: { detail: (rid: string) => ['object-types', 'detail', rid] },
}));

vi.mock('@/api/datasets', () => ({
  useDataset: vi.fn(() => ({ data: mockDataset })),
  useDatasetPreview: vi.fn(() => ({ data: mockPreview })),
  useDatasets: vi.fn(() => ({ data: mockDatasetsData })),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/object-types/${OT_RID}/datasources`]}>
        <Routes>
          <Route
            path="/object-types/:rid/datasources"
            element={<ObjectTypeDatasourcesPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ObjectTypeDatasourcesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockObjectType = undefined;
    mockDataset = undefined;
    mockPreview = undefined;
    mockDatasetsData = undefined;
  });

  it('renders empty state with add button when no datasource', () => {
    mockObjectType = {
      rid: OT_RID,
      id: 'employee',
      apiName: 'Employee',
      displayName: 'Employee',
      status: 'experimental',
      backingDatasource: null,
    };
    renderPage();
    expect(screen.getByText(/No datasource linked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Backing Datasource/ })).toBeInTheDocument();
  });

  it('renders datasource info when has datasource', () => {
    mockObjectType = {
      rid: OT_RID,
      id: 'employee',
      apiName: 'Employee',
      displayName: 'Employee',
      status: 'experimental',
      backingDatasource: { rid: DS_RID },
    };
    mockDataset = {
      rid: DS_RID,
      name: 'employees_table',
      sourceType: 'mysql',
      mode: 'snapshot',
      rowCount: 100,
      columnCount: 5,
      createdAt: '2026-01-01T00:00:00Z',
    };
    mockPreview = {
      columns: [
        { name: 'id', inferredType: 'integer' },
        { name: 'name', inferredType: 'string' },
      ],
      rows: [{ id: 1, name: 'Alice' }],
    };
    renderPage();
    expect(screen.getByText('employees_table')).toBeInTheDocument();
    expect(screen.getByText('Snapshot')).toBeInTheDocument();
    expect(screen.getByText('MYSQL')).toBeInTheDocument();
  });

  it('renders column schema and preview tables', () => {
    mockObjectType = {
      rid: OT_RID,
      id: 'employee',
      apiName: 'Employee',
      displayName: 'Employee',
      status: 'experimental',
      backingDatasource: { rid: DS_RID },
    };
    mockDataset = {
      rid: DS_RID,
      name: 'employees_table',
      sourceType: 'mysql',
      mode: 'snapshot',
      rowCount: 100,
      columnCount: 2,
      createdAt: '2026-01-01T00:00:00Z',
    };
    mockPreview = {
      columns: [
        { name: 'id', inferredType: 'integer' },
        { name: 'name', inferredType: 'string' },
      ],
      rows: [{ id: 1, name: 'Alice' }],
    };
    renderPage();
    expect(screen.getByText('Column Schema')).toBeInTheDocument();
    expect(screen.getByText('Data Preview (1 rows)')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('calls updateMutation on remove', async () => {
    const user = userEvent.setup();
    mockObjectType = {
      rid: OT_RID,
      id: 'employee',
      apiName: 'Employee',
      displayName: 'Employee',
      status: 'experimental',
      backingDatasource: { rid: DS_RID },
    };
    mockDataset = {
      rid: DS_RID,
      name: 'employees_table',
      sourceType: 'mysql',
      mode: 'snapshot',
      rowCount: 100,
      columnCount: 2,
      createdAt: '2026-01-01T00:00:00Z',
    };
    mockPreview = { columns: [], rows: [] };
    renderPage();

    const removeBtn = screen.getByRole('button', { name: /Remove Datasource/ });
    await user.click(removeBtn);

    // Popconfirm should show
    const confirmBtn = await screen.findByRole('button', { name: /confirm/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({ backingDatasourceRid: null });
    });
  });

  it('opens selector modal on add button click', async () => {
    const user = userEvent.setup();
    mockObjectType = {
      rid: OT_RID,
      id: 'employee',
      apiName: 'Employee',
      displayName: 'Employee',
      status: 'experimental',
      backingDatasource: null,
    };
    mockDatasetsData = { items: [] };
    renderPage();

    const addBtn = screen.getByRole('button', { name: /Add Backing Datasource/ });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Select Datasource')).toBeInTheDocument();
    });
  });

  it('shows link to data connection page when no datasource', () => {
    mockObjectType = {
      rid: OT_RID,
      id: 'employee',
      apiName: 'Employee',
      displayName: 'Employee',
      status: 'experimental',
      backingDatasource: null,
    };
    renderPage();
    expect(
      screen.getByText(/Go to Data Connection to import new datasets/),
    ).toBeInTheDocument();
  });
});

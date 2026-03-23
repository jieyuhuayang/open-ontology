import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import ObjectTypeInstancesPage from '@/pages/object-types/ObjectTypeInstancesPage';

const mockMutate = vi.fn();

// --- Mock: object-instances API ---
const mockSyncStatus = {
  rid: 'ri.ontology.sync-job.j1',
  objectTypeRid: 'ri.ontology.object-type.ot1',
  datasetRid: 'ri.ontology.dataset.ds1',
  status: 'completed' as const,
  syncType: 'incremental' as const,
  totalRows: 10,
  insertedCount: 3,
  updatedCount: 1,
  deletedCount: 0,
  unchangedCount: 6,
  errorMessage: null,
  startedAt: '2026-03-01T00:00:00Z',
  completedAt: '2026-03-01T00:00:05Z',
  triggeredBy: 'manual',
};

const mockInstances = {
  items: [
    {
      rid: 'ri.ontology.object-instance.i1',
      objectTypeRid: 'ri.ontology.object-type.ot1',
      primaryKeyValue: '1',
      titleValue: 'Alice',
      properties: { employeeId: '1', name: 'Alice' },
      sourceDatasetRid: 'ri.ontology.dataset.ds1',
      sourceRowIndex: 0,
      dataHash: 'abc',
      syncedAt: '2026-03-01T00:00:00Z',
      createdAt: '2026-03-01T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

let syncStatusReturn: ReturnType<typeof vi.fn> = vi.fn();
let instancesReturn: ReturnType<typeof vi.fn> = vi.fn();

vi.mock('@/api/object-instances', () => ({
  useObjectInstances: (..._args: unknown[]) => instancesReturn(),
  useSyncStatus: (..._args: unknown[]) => syncStatusReturn(),
  useTriggerSync: () => ({ mutate: mockMutate, isPending: false }),
  useObjectInstance: () => ({ data: null }),
}));

// --- Mock: object-types API ---
let otBackingDatasource: Record<string, unknown> | null = { rid: 'ds1', name: 'test' };
vi.mock('@/api/object-types', () => ({
  useObjectType: () => ({
    data: {
      rid: 'ri.ontology.object-type.ot1',
      displayName: 'Employee',
      backingDatasource: otBackingDatasource,
    },
    isLoading: false,
  }),
}));

// --- Mock: properties API ---
vi.mock('@/api/properties', () => ({
  useProperties: () => ({
    data: {
      items: [
        {
          rid: 'p1',
          id: 'employee-id',
          apiName: 'employeeId',
          displayName: 'Employee ID',
          backingColumn: 'emp_id',
          baseType: 'string',
          isPrimaryKey: true,
          isTitleKey: false,
        },
        {
          rid: 'p2',
          id: 'name',
          apiName: 'name',
          displayName: 'Name',
          backingColumn: 'full_name',
          baseType: 'string',
          isPrimaryKey: false,
          isTitleKey: true,
        },
        {
          rid: 'p3',
          id: 'notes',
          apiName: 'notes',
          displayName: 'Notes',
          backingColumn: null,
          baseType: 'string',
          isPrimaryKey: false,
          isTitleKey: false,
        },
      ],
    },
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/object-types/:rid/instances', element: <ObjectTypeInstancesPage /> }],
    { initialEntries: ['/object-types/ri.ontology.object-type.ot1/instances'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('ObjectTypeInstancesPage', () => {
  beforeEach(() => {
    mockMutate.mockClear();
    otBackingDatasource = { rid: 'ds1', name: 'test' };
    syncStatusReturn = () => ({ data: mockSyncStatus, isLoading: false });
    instancesReturn = () => ({ data: mockInstances, isLoading: false });
  });

  it('renders page title', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Object Instances')).toBeInTheDocument();
    });
  });

  it('renders sync status bar when sync record exists (AC-16)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Synced')).toBeInTheDocument();
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });
  });

  it('renders empty state when no sync record (AC-17)', async () => {
    syncStatusReturn = () => ({ data: null, isLoading: false });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No sync has been performed yet')).toBeInTheDocument();
    });
  });

  it('renders dynamic columns based on mapped properties (AC-18)', async () => {
    renderPage();
    await waitFor(() => {
      // Only properties with backingColumn should appear as columns
      expect(screen.getByText('Employee ID')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      // Property without backingColumn should NOT appear
      expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    });
  });

  it('triggers sync on Sync Now click (AC-19)', async () => {
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Sync Now'));
    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it('disables Sync Now when no datasource (AC-20)', async () => {
    otBackingDatasource = null;
    syncStatusReturn = () => ({ data: mockSyncStatus, isLoading: false });
    renderPage();
    await waitFor(() => {
      const btn = screen.getByText('Sync Now').closest('button');
      expect(btn).toBeDisabled();
    });
  });

  it('shows configure datasource message when no datasource and no sync (AC-17)', async () => {
    otBackingDatasource = null;
    syncStatusReturn = () => ({ data: null, isLoading: false });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText('Configure a backing datasource and publish to sync'),
      ).toBeInTheDocument();
    });
  });

  it('renders instance data in table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });
});

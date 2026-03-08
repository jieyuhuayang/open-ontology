import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import FileUploadWizard from '@/pages/data-connection/components/FileUploadWizard';
import { useDataConnectionStore } from '@/stores/data-connection-store';
import type { UploadPreviewResponse } from '@/api/imports';

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

const mockPreviewResult: UploadPreviewResponse = {
  fileToken: 'tok-123',
  filename: 'test.csv',
  fileSize: 1024,
  sheets: null,
  defaultSheet: null,
  preview: {
    columns: [
      { name: 'id', inferredType: 'integer', sampleValues: ['1', '2'] },
      { name: 'name', inferredType: 'string', sampleValues: ['Alice', 'Bob'] },
      { name: 'email', inferredType: 'string', sampleValues: ['a@b.com', 'b@c.com'] },
    ],
    rows: Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      name: `User${i + 1}`,
      email: `user${i + 1}@test.com`,
    })),
    totalRows: 20,
    hasHeader: true,
  },
};

const mockMutateAsync = vi.fn().mockResolvedValue(mockPreviewResult);

vi.mock('@/api/imports', () => ({
  useFileUploadPreview: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  useFileImportConfirm: vi.fn(() => ({
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
        <FileUploadWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FileUploadWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store and open the modal
    useDataConnectionStore.getState().setOpenModal('fileUpload');
  });

  it('selects all columns by default after upload', async () => {
    renderWizard();

    // Simulate file upload by triggering the dragger's beforeUpload
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    // Wait for step 1 to render with column checkboxes
    const checkboxes = await screen.findAllByRole('checkbox');
    // Filter to column checkboxes (exclude hasHeader checkbox)
    const columnCheckboxes = checkboxes.filter(
      (cb) => cb.closest('.ant-checkbox-group') !== null,
    );

    expect(columnCheckboxes).toHaveLength(3);
    for (const cb of columnCheckboxes) {
      expect(cb).toBeChecked();
    }
  });

  it('limits preview table to 10 rows', async () => {
    renderWizard();

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    // Wait for preview table to render
    await screen.findAllByRole('checkbox');

    // Count data rows in the table (exclude header row)
    const table = document.querySelector('.ant-table-tbody') as HTMLElement;
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(10);
  });
});

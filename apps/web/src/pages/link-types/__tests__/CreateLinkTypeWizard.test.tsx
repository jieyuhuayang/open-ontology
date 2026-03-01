import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CreateLinkTypeWizard from '@/pages/link-types/components/CreateLinkTypeWizard';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';

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

vi.mock('@/api/link-types', () => ({
  useCreateLinkType: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/api/object-types', () => ({
  useObjectTypes: vi.fn(() => ({
    data: {
      items: [
        {
          rid: 'ot-a',
          id: 'employee',
          displayName: 'Employee',
          changeState: 'created',
        },
        {
          rid: 'ot-b',
          id: 'company',
          displayName: 'Company',
          changeState: 'created',
        },
      ],
    },
  })),
}));

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreateLinkTypeWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreateLinkTypeWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateLinkTypeModalStore.getState().close();
  });

  it('does not render when modal is closed', () => {
    renderWizard();
    expect(screen.queryByText(/cardinality/i)).not.toBeInTheDocument();
  });

  it('shows step 1 (cardinality) when modal is open', () => {
    useCreateLinkTypeModalStore.getState().open();
    renderWizard();
    expect(screen.getByText(/one to one/i)).toBeInTheDocument();
    expect(screen.getByText(/one to many/i)).toBeInTheDocument();
    expect(screen.getByText(/many to one/i)).toBeInTheDocument();
  });

  it('advances to step 2 after selecting cardinality', async () => {
    useCreateLinkTypeModalStore.getState().open();
    renderWizard();

    // Select one-to-many cardinality
    await userEvent.click(screen.getByText(/one to many/i));
    // Click Next
    await userEvent.click(screen.getByText(/next/i));

    // Step 2 should show Side A / Side B labels
    expect(screen.getByText(/side a/i)).toBeInTheDocument();
    expect(screen.getByText(/side b/i)).toBeInTheDocument();
  });
});

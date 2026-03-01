import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LinkTypeListPage from '@/pages/link-types/LinkTypeListPage';

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
  useLinkTypes: vi.fn(),
  useLinkType: vi.fn(() => ({ data: null })),
  useCreateLinkType: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateLinkType: vi.fn(() => ({ mutate: vi.fn() })),
  useDeleteLinkType: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/api/object-types', () => ({
  useObjectTypes: vi.fn(() => ({ data: null })),
}));

import { useLinkTypes } from '@/api/link-types';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LinkTypeListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LinkTypeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no link types exist', () => {
    vi.mocked(useLinkTypes).mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
    } as unknown as ReturnType<typeof useLinkTypes>);

    renderPage();
    expect(screen.getByText(/create your first link type/i)).toBeInTheDocument();
  });

  it('shows link types in table when data exists', () => {
    vi.mocked(useLinkTypes).mockReturnValue({
      data: {
        items: [
          {
            rid: 'ri.ontology.link-type.abc',
            id: 'employee-company',
            sideA: {
              objectTypeRid: 'ot-a',
              displayName: 'Company',
              apiName: 'company',
              visibility: 'normal',
              objectTypeDisplayName: 'Employee',
            },
            sideB: {
              objectTypeRid: 'ot-b',
              displayName: 'Employee',
              apiName: 'employee',
              visibility: 'normal',
              objectTypeDisplayName: 'Company',
            },
            cardinality: 'many-to-one',
            joinMethod: 'foreign-key',
            status: 'experimental',
            projectRid: 'p',
            ontologyRid: 'o',
            createdAt: '2024-01-01T00:00:00Z',
            createdBy: 'default',
            lastModifiedAt: '2024-01-01T00:00:00Z',
            lastModifiedBy: 'default',
            changeState: 'created',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useLinkTypes>);

    renderPage();
    expect(screen.getByText('employee-company')).toBeInTheDocument();
  });

  it('shows title and new button', () => {
    vi.mocked(useLinkTypes).mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
    } as unknown as ReturnType<typeof useLinkTypes>);

    renderPage();
    expect(screen.getByText('Link Types', { selector: 'h4' })).toBeInTheDocument();
  });
});

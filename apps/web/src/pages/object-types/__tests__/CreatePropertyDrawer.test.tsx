import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CreatePropertyDrawer from '../components/CreatePropertyDrawer';

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

const mockMutateAsync = vi.fn();

vi.mock('@/api/properties', () => ({
  useCreateProperty: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  propertyKeys: { list: (rid: string) => ['properties', 'list', rid] },
}));

vi.mock('@/api/object-types', () => ({
  objectTypeKeys: { detail: (rid: string) => ['object-types', 'detail', rid] },
}));

function renderDrawer(open = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onClose = vi.fn();
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreatePropertyDrawer
            open={open}
            objectTypeRid="ri.ontology.object-type.test"
            onClose={onClose}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('CreatePropertyDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields when open', () => {
    renderDrawer(true);
    // Check for key form labels
    expect(screen.getByText('property.fields.displayName')).toBeInTheDocument();
    expect(screen.getByText('property.fields.id')).toBeInTheDocument();
    expect(screen.getByText('property.fields.apiName')).toBeInTheDocument();
    expect(screen.getByText('property.fields.baseType')).toBeInTheDocument();
  });

  it('renders create and cancel buttons', () => {
    renderDrawer(true);
    expect(screen.getByRole('button', { name: /common\.create/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /common\.cancel/ })).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderDrawer(false);
    // drawer with destroyOnClose will remove content
    expect(screen.queryByText('property.fields.displayName')).not.toBeInTheDocument();
  });

  it('renders status and visibility selects with defaults', () => {
    renderDrawer(true);
    expect(screen.getByText('property.fields.status')).toBeInTheDocument();
    expect(screen.getByText('property.fields.visibility')).toBeInTheDocument();
  });

  it('renders backingColumn and description fields', () => {
    renderDrawer(true);
    expect(screen.getByText('property.fields.backingColumn')).toBeInTheDocument();
    expect(screen.getByText('property.fields.description')).toBeInTheDocument();
  });
});

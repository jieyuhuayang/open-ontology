import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EditPropertyPanel from '../components/EditPropertyPanel';
import type { Property } from '@/api/types';

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

const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('@/api/properties', () => ({
  useUpdateProperty: vi.fn(() => ({
    mutateAsync: mockUpdateMutate,
  })),
  useDeleteProperty: vi.fn(() => ({
    mutateAsync: mockDeleteMutate,
  })),
  propertyKeys: { list: (rid: string) => ['properties', 'list', rid] },
}));

vi.mock('@/api/object-types', () => ({
  objectTypeKeys: { detail: (rid: string) => ['object-types', 'detail', rid] },
}));

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    rid: 'ri.ontology.property.p1',
    id: 'name',
    apiName: 'name',
    objectTypeRid: 'ri.ontology.object-type.test',
    displayName: 'Name',
    description: null,
    baseType: 'string',
    arrayInnerType: null,
    structSchema: null,
    backingColumn: null,
    status: 'experimental',
    visibility: 'normal',
    isPrimaryKey: false,
    isTitleKey: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'default',
    lastModifiedAt: '2026-01-01T00:00:00Z',
    lastModifiedBy: 'default',
    changeState: 'created',
    ...overrides,
  } as Property;
}

function renderPanel(property: Property | null, objectTypeStatus = 'experimental') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onClose = vi.fn();
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EditPropertyPanel
            property={property}
            objectTypeStatus={objectTypeStatus}
            onClose={onClose}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('EditPropertyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when property is null', () => {
    const { container } = renderPanel(null);
    expect(container.innerHTML).toBe('');
  });

  it('renders property details', () => {
    const prop = makeProperty({ displayName: 'Employee Name', id: 'emp-name' });
    renderPanel(prop);
    // displayName appears as drawer title + detail value, so use getAllByText
    expect(screen.getAllByText('Employee Name').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('emp-name')).toBeInTheDocument();
    expect(screen.getByText('RID')).toBeInTheDocument();
    expect(screen.getByText('Base Type')).toBeInTheDocument();
  });

  it('shows PK set button for valid PK type', () => {
    const prop = makeProperty({ baseType: 'string', isPrimaryKey: false });
    renderPanel(prop);
    expect(screen.getByText('Set as Primary Key')).toBeInTheDocument();
  });

  it('shows PK unset button when property is PK', () => {
    const prop = makeProperty({ baseType: 'string', isPrimaryKey: true });
    renderPanel(prop);
    expect(screen.getByText('Unset Primary Key')).toBeInTheDocument();
  });

  it('does not show PK set button for invalid PK type (struct)', () => {
    const prop = makeProperty({ baseType: 'struct', isPrimaryKey: false });
    renderPanel(prop);
    expect(screen.getByText(/cannot be used as a primary key/)).toBeInTheDocument();
    expect(screen.queryByText('Set as Primary Key')).not.toBeInTheDocument();
  });

  it('disables PK set button when OT is active', () => {
    const prop = makeProperty({ baseType: 'string', isPrimaryKey: false });
    renderPanel(prop, 'active');
    const setBtn = screen.getByText('Set as Primary Key').closest('button');
    expect(setBtn).toBeDisabled();
  });

  it('shows TK set button for valid TK type', () => {
    const prop = makeProperty({ baseType: 'decimal', isPrimaryKey: false, isTitleKey: false });
    renderPanel(prop);
    expect(screen.getByText('Set as Title Key')).toBeInTheDocument();
  });

  it('shows TK unset button when property is TK', () => {
    const prop = makeProperty({ baseType: 'string', isTitleKey: true });
    renderPanel(prop);
    expect(screen.getByText('Unset Title Key')).toBeInTheDocument();
  });

  it('disables delete button for active property', () => {
    const prop = makeProperty({ status: 'active' });
    renderPanel(prop);
    const deleteBtn = screen.getByRole('button', { name: /Delete/ });
    expect(deleteBtn).toBeDisabled();
  });

  it('disables delete button for PK property', () => {
    const prop = makeProperty({ isPrimaryKey: true });
    renderPanel(prop);
    const deleteBtn = screen.getByRole('button', { name: /Delete/ });
    expect(deleteBtn).toBeDisabled();
  });

  it('shows apiName field label', () => {
    const prop = makeProperty({ status: 'active', apiName: 'activeField' });
    renderPanel(prop);
    expect(screen.getByText('API Name')).toBeInTheDocument();
  });
});

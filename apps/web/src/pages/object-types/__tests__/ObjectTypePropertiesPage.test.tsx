import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ObjectTypePropertiesPage from '../ObjectTypePropertiesPage';
import type { Property, PropertyListResponse } from '@/api/types';

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

const mockObjectType = {
  rid: OT_RID,
  id: 'employee',
  apiName: 'Employee',
  displayName: 'Employee',
  status: 'experimental',
  visibility: 'normal',
  changeState: 'created',
};

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    rid: 'ri.ontology.property.p1',
    id: 'name',
    apiName: 'name',
    objectTypeRid: OT_RID,
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

let mockPropertiesData: PropertyListResponse | undefined;

vi.mock('@/api/object-types', () => ({
  useObjectType: vi.fn(() => ({ data: mockObjectType })),
  objectTypeKeys: { detail: (rid: string) => ['object-types', 'detail', rid] },
}));

vi.mock('@/api/properties', () => ({
  useProperties: vi.fn(() => ({
    data: mockPropertiesData,
    isLoading: false,
  })),
  useReorderProperties: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useCreateProperty: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateProperty: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useDeleteProperty: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  propertyKeys: { list: (rid: string) => ['properties', 'list', rid] },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/object-types/${OT_RID}/properties`]}>
        <Routes>
          <Route
            path="/object-types/:rid/properties"
            element={<ObjectTypePropertiesPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ObjectTypePropertiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropertiesData = undefined;
  });

  it('renders empty state when no properties', () => {
    mockPropertiesData = { items: [], total: 0 };
    renderPage();
    expect(screen.getByText(/No properties yet/)).toBeInTheDocument();
  });

  it('renders property list when properties exist', () => {
    mockPropertiesData = {
      items: [
        makeProperty({ rid: 'r1', id: 'name', displayName: 'Name' }),
        makeProperty({ rid: 'r2', id: 'age', displayName: 'Age', baseType: 'integer' }),
      ],
      total: 2,
    };
    renderPage();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('renders filter selects', () => {
    mockPropertiesData = { items: [], total: 0 };
    renderPage();
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(3);
  });

  it('renders add button', () => {
    mockPropertiesData = { items: [], total: 0 };
    renderPage();
    expect(screen.getByRole('button', { name: /Add Property/ })).toBeInTheDocument();
  });

  it('disables add button when at 200 limit', () => {
    const items = Array.from({ length: 200 }, (_, i) =>
      makeProperty({ rid: `r${i}`, id: `p${i}`, apiName: `p${i}`, sortOrder: i }),
    );
    mockPropertiesData = { items, total: 200 };
    renderPage();
    const addBtn = screen.getByRole('button', { name: /Add Property/ });
    expect(addBtn).toBeDisabled();
  });
});

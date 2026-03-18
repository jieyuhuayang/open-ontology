import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PropertiesPage from '../PropertiesPage';
import type { PropertyWithObjectType, PropertyListAllResponse } from '@/api/types';

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

let mockData: PropertyListAllResponse | undefined;

vi.mock('@/api/properties', () => ({
  useAllProperties: vi.fn(() => ({
    data: mockData,
    isLoading: false,
  })),
}));

function makePropertyWithOT(overrides: Partial<PropertyWithObjectType> = {}): PropertyWithObjectType {
  return {
    rid: 'ri.ontology.property.p1',
    id: 'name',
    apiName: 'name',
    objectTypeRid: 'ri.ontology.object-type.test',
    objectTypeDisplayName: 'Employee',
    displayName: 'Name',
    description: null,
    baseType: 'string',
    arrayInnerType: null,
    status: 'experimental',
    visibility: 'normal',
    isPrimaryKey: false,
    isTitleKey: false,
    changeState: 'created',
    ...overrides,
  } as PropertyWithObjectType;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PropertiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData = undefined;
  });

  it('renders empty state when no properties exist', () => {
    mockData = { items: [], total: 0 };
    renderPage();
    expect(screen.getByText(/No properties yet/)).toBeInTheDocument();
  });

  it('renders properties table when data exists', () => {
    mockData = {
      items: [
        makePropertyWithOT({ rid: 'r1', displayName: 'Name', objectTypeDisplayName: 'Employee' }),
        makePropertyWithOT({ rid: 'r2', displayName: 'Code', objectTypeDisplayName: 'Department' }),
      ],
      total: 2,
    };
    renderPage();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Employee')).toBeInTheDocument();
    expect(screen.getByText('Department')).toBeInTheDocument();
  });

  it('renders page title', () => {
    mockData = { items: [], total: 0 };
    renderPage();
    expect(screen.getByText('Properties', { selector: 'h4' })).toBeInTheDocument();
  });

  it('renders filter selects when data exists', () => {
    mockData = {
      items: [makePropertyWithOT()],
      total: 1,
    };
    renderPage();
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(4);
  });
});

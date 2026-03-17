import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchResultsPanel from '../SearchResultsPanel';
import { useSearchStore } from '@/stores/search-store';

// Mock window.matchMedia for Ant Design Table
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

const mockSearchData = {
  query: 'Employee',
  results: {
    objectTypes: {
      items: [
        {
          rid: 'ri.ontology.object-type.1',
          resourceType: 'objectType' as const,
          displayName: 'Employee',
          description: 'Employee records',
          icon: { name: 'UserOutlined', color: '#000' },
          status: 'active',
          visibility: 'normal',
          changeState: 'published',
          matchedFields: ['name'],
        },
      ],
      total: 1,
    },
    properties: { items: [], total: 0 },
    linkTypes: { items: [], total: 0 },
  },
  totalCount: 1,
};

const emptySearchData = {
  query: 'nothing',
  results: {
    objectTypes: { items: [], total: 0 },
    properties: { items: [], total: 0 },
    linkTypes: { items: [], total: 0 },
  },
  totalCount: 0,
};

vi.mock('@/api/search', () => ({
  useSearch: vi.fn(),
}));

import { useSearch } from '@/api/search';
const mockUseSearch = vi.mocked(useSearch);

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('SearchResultsPanel', () => {
  beforeEach(() => {
    useSearchStore.setState({ query: 'Employee', isSearchMode: true, activeType: 'all' });
    vi.clearAllMocks();
  });

  it('renders group view with results', () => {
    mockUseSearch.mockReturnValue({
      data: mockSearchData,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSearch>);

    renderWithRouter(<SearchResultsPanel />);
    expect(screen.getByText(/Object Types/)).toBeInTheDocument();
    // SearchHighlight wraps matching text in <mark>, so check container
    expect(screen.getByText('Employee')).toBeInTheDocument();
  });

  it('renders empty state when no results', () => {
    mockUseSearch.mockReturnValue({
      data: emptySearchData,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSearch>);

    useSearchStore.setState({ query: 'nothing' });
    renderWithRouter(<SearchResultsPanel />);
    expect(screen.getByText(/No results found/)).toBeInTheDocument();
  });

  it('show all switches active type', () => {
    const manyItems = Array.from({ length: 6 }, (_, i) => ({
      rid: `ri.ontology.object-type.${i}`,
      resourceType: 'objectType' as const,
      displayName: `Employee${i}`,
      status: 'active',
      visibility: 'normal',
      changeState: 'published',
      matchedFields: ['name'],
    }));
    mockUseSearch.mockReturnValue({
      data: {
        query: 'Employee',
        results: {
          objectTypes: { items: manyItems, total: 6 },
          properties: { items: [], total: 0 },
          linkTypes: { items: [], total: 0 },
        },
        totalCount: 6,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSearch>);

    useSearchStore.setState({ query: 'Employee' });
    renderWithRouter(<SearchResultsPanel />);

    const showAllBtn = screen.getByText(/Show all/);
    expect(showAllBtn).toBeInTheDocument();
    fireEvent.click(showAllBtn);
    expect(useSearchStore.getState().activeType).toBe('objectType');
  });
});

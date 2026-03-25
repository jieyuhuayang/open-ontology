import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BlueprintReviewPanel from '../components/BlueprintReviewPanel';

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

const mockBlueprintDetail = vi.fn();

vi.mock('@/api/blueprints', () => ({
  useBlueprintDetail: (...args: unknown[]) => mockBlueprintDetail(...args),
  useUpdateItemDecision: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useBatchUpdateDecisions: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  usePreApplyCheck: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useApplyBlueprint: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useRetryItem: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  blueprintKeys: { detail: (rid: string) => ['blueprints', 'detail', rid] },
}));

function renderPanel(blueprintRid: string | null = 'ri.ontology.blueprint.test1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BlueprintReviewPanel blueprintRid={blueprintRid} />
    </QueryClientProvider>,
  );
}

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  rid: 'ri.ontology.blueprint-item.item1',
  blueprintRid: 'ri.ontology.blueprint.test1',
  itemType: 'object_type',
  suggestion: { displayName: 'Order', apiName: 'Order' },
  confidence: 0.92,
  confidenceLevel: 'high',
  reasoning: 'test',
  source: 'field_analysis',
  userDecision: null,
  userEdits: null,
  rejectionReason: null,
  createdEntityRid: null,
  sortOrder: 0,
  createdAt: '2026-03-25T00:00:00Z',
  updatedAt: '2026-03-25T00:00:00Z',
  ...overrides,
});

describe('BlueprintReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no blueprintRid', () => {
    mockBlueprintDetail.mockReturnValue({ data: null, isLoading: false });
    renderPanel(null);
    expect(screen.getByText(/暂无蓝图建议|No blueprint suggestions/i)).toBeTruthy();
  });

  it('renders spinner when loading', () => {
    mockBlueprintDetail.mockReturnValue({ data: null, isLoading: true });
    renderPanel();
    expect(document.querySelector('.ant-spin')).toBeTruthy();
  });

  it('renders spinner for draft blueprint', () => {
    mockBlueprintDetail.mockReturnValue({
      data: {
        blueprint: { rid: 'bp1', status: 'draft', name: 'Test' },
        items: [],
      },
      isLoading: false,
    });
    renderPanel();
    expect(document.querySelector('.ant-spin')).toBeTruthy();
  });

  it('renders review table for pending_review blueprint', () => {
    mockBlueprintDetail.mockReturnValue({
      data: {
        blueprint: { rid: 'bp1', status: 'pending_review', name: 'Test' },
        items: [makeItem()],
      },
      isLoading: false,
    });
    renderPanel();
    expect(screen.getByTestId('blueprint-review-panel')).toBeTruthy();
    expect(screen.getByTestId('review-toolbar')).toBeTruthy();
  });

  it('renders read-only summary for applied blueprint', () => {
    mockBlueprintDetail.mockReturnValue({
      data: {
        blueprint: { rid: 'bp1', status: 'applied', name: 'Test' },
        items: [
          makeItem({ userDecision: 'accepted', createdEntityRid: 'ri.ontology.object-type.x' }),
        ],
      },
      isLoading: false,
    });
    renderPanel();
    expect(screen.getByText(/蓝图已应用|Blueprint applied/i)).toBeTruthy();
  });

  it('shows Accept All button in toolbar', () => {
    mockBlueprintDetail.mockReturnValue({
      data: {
        blueprint: { rid: 'bp1', status: 'pending_review', name: 'Test' },
        items: [makeItem()],
      },
      isLoading: false,
    });
    renderPanel();
    expect(screen.getByText(/全部接受|Accept All/i)).toBeTruthy();
  });

  it('disables Apply button when no actionable items', () => {
    mockBlueprintDetail.mockReturnValue({
      data: {
        blueprint: { rid: 'bp1', status: 'pending_review', name: 'Test' },
        items: [makeItem({ userDecision: 'rejected' })],
      },
      isLoading: false,
    });
    renderPanel();
    const applyBtn = screen.getByText(/应用蓝图|Apply Blueprint/i).closest('button');
    expect(applyBtn?.disabled).toBe(true);
  });

  it('shows confidence badge with correct color', () => {
    mockBlueprintDetail.mockReturnValue({
      data: {
        blueprint: { rid: 'bp1', status: 'pending_review', name: 'Test' },
        items: [makeItem({ confidence: 0.92, confidenceLevel: 'high' })],
      },
      isLoading: false,
    });
    renderPanel();
    expect(screen.getByText('92%')).toBeTruthy();
  });
});
